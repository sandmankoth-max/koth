import UIKit
import AVFoundation

/// Plays splash.mp4 fullscreen above the Capacitor WebView on COLD launch only.
///
/// Flow: native LaunchScreen (held for at least `minLaunchScreenDuration`) →
/// this video → web view revealed when playback ends (or after a hard
/// timeout fallback so a stuck player never freezes the app).
///
/// `didPlayThisProcess` is a process-lifetime flag, so backgrounding and
/// returning to the app never replays the video — only a true cold launch
/// (process re-spawn) resets it.
final class SplashVideoViewController: UIViewController {

    static var didPlayThisProcess = false

    /// Minimum time the native LaunchScreen image is visible before the video
    /// overlay is attached. Guarantees branding doesn't flash by.
    private static let minLaunchScreenDuration: TimeInterval = 1.0

    /// Hard ceiling on how long the splash overlay stays up, in case the
    /// player stalls or the end notification never fires.
    private static let maxOverlayDuration: TimeInterval = 6.0

    private var player: AVPlayer?
    private var playerLayer: AVPlayerLayer?
    private var endObserver: NSObjectProtocol?
    private var statusObservation: NSKeyValueObservation?
    private var timeoutWork: DispatchWorkItem?
    private var onFinish: (() -> Void)?
    private var finished = false

    @discardableResult
    static func presentIfNeeded(over host: UIView) -> Bool {
        guard !didPlayThisProcess else { return false }
        guard let url = Bundle.main.url(forResource: "splash", withExtension: "mp4") else {
            didPlayThisProcess = true
            return false
        }
        didPlayThisProcess = true

        DispatchQueue.main.asyncAfter(deadline: .now() + minLaunchScreenDuration) {
            let overlay = SplashVideoViewController()
            overlay.view.frame = host.bounds
            overlay.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            host.addSubview(overlay.view)
            overlay.start(url: url) { [weak overlay] in
                UIView.animate(withDuration: 0.25, animations: {
                    overlay?.view.alpha = 0
                }, completion: { _ in
                    overlay?.view.removeFromSuperview()
                })
            }
        }
        return true
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        view.isUserInteractionEnabled = false
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        playerLayer?.frame = view.bounds
    }

    private func start(url: URL, onFinish: @escaping () -> Void) {
        self.onFinish = onFinish

        try? AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default, options: [.mixWithOthers])

        let item = AVPlayerItem(url: url)
        let player = AVPlayer(playerItem: item)
        player.isMuted = true
        player.actionAtItemEnd = .pause
        player.automaticallyWaitsToMinimizeStalling = false

        let layer = AVPlayerLayer(player: player)
        layer.videoGravity = .resizeAspectFill
        layer.frame = view.bounds
        view.layer.addSublayer(layer)

        self.player = player
        self.playerLayer = layer

        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            self?.finish()
        }

        // Fallback: also dismiss on playback failure or stall.
        statusObservation = item.observe(\.status, options: [.new]) { [weak self] item, _ in
            if item.status == .failed { DispatchQueue.main.async { self?.finish() } }
        }

        // Absolute timeout so the overlay can never strand the app.
        let work = DispatchWorkItem { [weak self] in self?.finish() }
        timeoutWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.maxOverlayDuration, execute: work)

        player.play()
    }

    private func finish() {
        guard !finished else { return }
        finished = true
        timeoutWork?.cancel()
        timeoutWork = nil
        statusObservation?.invalidate()
        statusObservation = nil
        if let obs = endObserver {
            NotificationCenter.default.removeObserver(obs)
            endObserver = nil
        }
        player?.pause()
        let cb = onFinish
        onFinish = nil
        cb?()
    }

    deinit {
        if let obs = endObserver {
            NotificationCenter.default.removeObserver(obs)
        }
        statusObservation?.invalidate()
        timeoutWork?.cancel()
    }
}
