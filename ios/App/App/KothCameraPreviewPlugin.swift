import AVFoundation
import Capacitor
import UIKit

@objc(KothCameraPreview)
class KothCameraPreviewPlugin: CAPPlugin, CAPBridgedPlugin, AVCaptureFileOutputRecordingDelegate {
    let identifier = "KothCameraPreviewPlugin"
    let jsName = "KothCameraPreview"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "flip", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setFlashMode", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startRecordVideo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopRecordVideo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isCameraStarted", returnType: CAPPluginReturnPromise),
    ]

    private let sessionQueue = DispatchQueue(label: "koth.camera.session")
    private var captureSession: AVCaptureSession?
    private var videoInput: AVCaptureDeviceInput?
    private var audioInput: AVCaptureDeviceInput?
    private var movieOutput: AVCaptureMovieFileOutput?
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var previewView: UIView?
    private var cameraPosition: AVCaptureDevice.Position = .back
    private var disableAudio = false
    private var startRecordCall: CAPPluginCall?
    private var stopRecordCall: CAPPluginCall?
    private var pendingStopAfterRecording = false

    @objc func start(_ call: CAPPluginCall) {
        cameraPosition = (call.getString("position") == "front") ? .front : .back
        disableAudio = call.getBool("disableAudio") ?? false

        AVCaptureDevice.requestAccess(for: .video) { [weak self] videoGranted in
            guard let self = self else { return }
            guard videoGranted else {
                call.reject("Camera permission denied")
                return
            }

            if self.disableAudio {
                self.configureAndStart(call)
                return
            }

            AVCaptureDevice.requestAccess(for: .audio) { audioGranted in
                if !audioGranted {
                    self.disableAudio = true
                }
                self.configureAndStart(call)
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        sessionQueue.async { [weak self] in
            guard let self = self else { return }

            if self.movieOutput?.isRecording == true {
                self.pendingStopAfterRecording = true
                self.movieOutput?.stopRecording()
            }

            self.captureSession?.stopRunning()
            self.captureSession = nil
            self.movieOutput = nil
            self.videoInput = nil
            self.audioInput = nil

            DispatchQueue.main.async {
                self.previewLayer?.removeFromSuperlayer()
                self.previewLayer = nil
                self.previewView?.removeFromSuperview()
                self.previewView = nil
                self.webView?.isOpaque = false
                self.webView?.backgroundColor = .clear
                self.webView?.scrollView.backgroundColor = .clear
                call.resolve()
            }
        }
    }

    @objc func flip(_ call: CAPPluginCall) {
        cameraPosition = (cameraPosition == .front) ? .back : .front
        sessionQueue.async { [weak self] in
            guard let self = self else { return }
            do {
                try self.configureSession(position: self.cameraPosition, disableAudio: self.disableAudio)
                DispatchQueue.main.async {
                    self.updatePreviewConnection()
                    call.resolve()
                }
            } catch {
                DispatchQueue.main.async { call.reject(error.localizedDescription) }
            }
        }
    }

    @objc func setFlashMode(_ call: CAPPluginCall) {
        let mode = call.getString("flashMode") ?? "off"
        sessionQueue.async { [weak self] in
            guard let self = self else { return }
            guard let device = self.videoInput?.device, device.hasTorch else {
                DispatchQueue.main.async { call.resolve() }
                return
            }

            do {
                try device.lockForConfiguration()
                if mode == "torch" && device.isTorchModeSupported(.on) {
                    try device.setTorchModeOn(level: AVCaptureDevice.maxAvailableTorchLevel)
                } else {
                    device.torchMode = .off
                }
                device.unlockForConfiguration()
                DispatchQueue.main.async { call.resolve() }
            } catch {
                DispatchQueue.main.async { call.reject("failed to set flash mode") }
            }
        }
    }

    @objc func startRecordVideo(_ call: CAPPluginCall) {
        sessionQueue.async { [weak self] in
            guard let self = self else { return }
            guard let session = self.captureSession, session.isRunning, let movieOutput = self.movieOutput else {
                DispatchQueue.main.async { call.reject("Capture Session is Missing") }
                return
            }
            guard !movieOutput.isRecording else {
                DispatchQueue.main.async { call.resolve() }
                return
            }

            let url = self.newVideoURL()
            try? FileManager.default.removeItem(at: url)
            self.startRecordCall = call

            if let connection = movieOutput.connection(with: .video) {
                self.applyOrientation(to: connection)
                if connection.isVideoMirroringSupported {
                    connection.isVideoMirrored = false
                }
            }

            movieOutput.movieFragmentInterval = .invalid
            movieOutput.startRecording(to: url, recordingDelegate: self)
            DispatchQueue.main.async {
                call.resolve()
            }
        }
    }

    @objc func stopRecordVideo(_ call: CAPPluginCall) {
        sessionQueue.async { [weak self] in
            guard let self = self else { return }
            guard let movieOutput = self.movieOutput, movieOutput.isRecording else {
                DispatchQueue.main.async { call.reject("Not recording") }
                return
            }

            self.stopRecordCall = call
            movieOutput.stopRecording()
        }
    }

    @objc func isCameraStarted(_ call: CAPPluginCall) {
        sessionQueue.async { [weak self] in
            let started = self?.captureSession?.isRunning == true
            DispatchQueue.main.async { call.resolve(["value": started]) }
        }
    }

    private func configureAndStart(_ call: CAPPluginCall) {
        sessionQueue.async { [weak self] in
            guard let self = self else { return }
            do {
                try self.configureSession(position: self.cameraPosition, disableAudio: self.disableAudio)
                self.captureSession?.startRunning()

                DispatchQueue.main.async {
                    self.installPreview(call: call)
                    call.resolve()
                }
            } catch {
                DispatchQueue.main.async { call.reject(error.localizedDescription) }
            }
        }
    }

    private func configureSession(position: AVCaptureDevice.Position, disableAudio: Bool) throws {
        let session = captureSession ?? AVCaptureSession()
        captureSession = session

        session.beginConfiguration()
        session.sessionPreset = .high

        if let input = videoInput { session.removeInput(input) }
        if let input = audioInput { session.removeInput(input) }
        if let output = movieOutput { session.removeOutput(output) }

        let videoDevice = try cameraDevice(position: position)
        let newVideoInput = try AVCaptureDeviceInput(device: videoDevice)
        guard session.canAddInput(newVideoInput) else { throw CameraError.inputsAreInvalid }
        session.addInput(newVideoInput)
        videoInput = newVideoInput

        if !disableAudio, let audioDevice = AVCaptureDevice.default(for: .audio) {
            let newAudioInput = try AVCaptureDeviceInput(device: audioDevice)
            if session.canAddInput(newAudioInput) {
                session.addInput(newAudioInput)
                audioInput = newAudioInput
            }
        }

        let newMovieOutput = AVCaptureMovieFileOutput()
        guard session.canAddOutput(newMovieOutput) else { throw CameraError.outputsAreInvalid }
        session.addOutput(newMovieOutput)
        movieOutput = newMovieOutput

        if let connection = newMovieOutput.connection(with: .video) {
            applyOrientation(to: connection)
        }

        session.commitConfiguration()
    }

    private func installPreview(call: CAPPluginCall) {
        let width = CGFloat(call.getDouble("width") ?? Double(UIScreen.main.bounds.width))
        let height = CGFloat(call.getDouble("height") ?? Double(UIScreen.main.bounds.height))
        let x = CGFloat(call.getDouble("x") ?? 0)
        let y = CGFloat(call.getDouble("y") ?? 0)

        previewLayer?.removeFromSuperlayer()
        previewView?.removeFromSuperview()

        let view = UIView(frame: CGRect(x: x, y: y, width: width, height: height))
        view.backgroundColor = .clear
        previewView = view

        let layer = AVCaptureVideoPreviewLayer(session: captureSession!)
        layer.videoGravity = .resizeAspectFill
        layer.frame = view.bounds
        previewLayer = layer
        view.layer.insertSublayer(layer, at: 0)

        webView?.isOpaque = false
        webView?.backgroundColor = .clear
        webView?.scrollView.isOpaque = false
        webView?.scrollView.backgroundColor = .clear
        webView?.superview?.insertSubview(view, belowSubview: webView!)
        updatePreviewConnection()
    }

    private func updatePreviewConnection() {
        guard let connection = previewLayer?.connection else { return }
        applyOrientation(to: connection)
        if connection.isVideoMirroringSupported {
            connection.automaticallyAdjustsVideoMirroring = false
            connection.isVideoMirrored = cameraPosition == .front
        }
    }

    private func applyOrientation(to connection: AVCaptureConnection) {
        if connection.isVideoOrientationSupported {
            connection.videoOrientation = .portrait
        }
    }

    private func cameraDevice(position: AVCaptureDevice.Position) throws -> AVCaptureDevice {
        let preferredTypes: [AVCaptureDevice.DeviceType] = [
            .builtInWideAngleCamera,
            .builtInDualWideCamera,
            .builtInDualCamera,
            .builtInTrueDepthCamera,
        ]

        for type in preferredTypes {
            if let device = AVCaptureDevice.default(type, for: .video, position: position) {
                try configureDeviceForLowestNativeZoom(device)
                return device
            }
        }

        guard let device = AVCaptureDevice.default(for: .video) else { throw CameraError.noCamera }
        try configureDeviceForLowestNativeZoom(device)
        return device
    }

    private func configureDeviceForLowestNativeZoom(_ device: AVCaptureDevice) throws {
        try device.lockForConfiguration()
        device.videoZoomFactor = 1.0
        if device.isFocusModeSupported(.continuousAutoFocus) {
            device.focusMode = .continuousAutoFocus
        }
        if device.isExposureModeSupported(.continuousAutoExposure) {
            device.exposureMode = .continuousAutoExposure
        }
        device.unlockForConfiguration()
    }

    private func newVideoURL() -> URL {
        let directory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        let filename = "koth_video_\(UUID().uuidString.replacingOccurrences(of: "-", with: "")).mov"
        return directory.appendingPathComponent(filename)
    }

    func fileOutput(_ output: AVCaptureFileOutput, didStartRecordingTo fileURL: URL, from connections: [AVCaptureConnection]) {
        DispatchQueue.main.async { [weak self] in
            self?.startRecordCall = nil
        }
    }

    func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo outputFileURL: URL, from connections: [AVCaptureConnection], error: Error?) {
        let call = stopRecordCall
        stopRecordCall = nil

        if pendingStopAfterRecording {
            pendingStopAfterRecording = false
            startRecordCall = nil
            try? FileManager.default.removeItem(at: outputFileURL)
            return
        }

        DispatchQueue.main.async {
            if let error = error {
                self.startRecordCall?.reject(error.localizedDescription)
                self.startRecordCall = nil
                call?.reject(error.localizedDescription)
                return
            }

            call?.resolve([
                "videoFilePath": outputFileURL.path,
                "value": outputFileURL.absoluteString,
            ])
        }
    }
}

private enum CameraError: LocalizedError {
    case noCamera
    case inputsAreInvalid
    case outputsAreInvalid

    var errorDescription: String? {
        switch self {
        case .noCamera:
            return "Failed to access device camera"
        case .inputsAreInvalid:
            return "Camera input is unavailable"
        case .outputsAreInvalid:
            return "Video recording output is unavailable"
        }
    }
}