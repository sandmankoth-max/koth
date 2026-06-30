import UIKit
import AVFoundation

/// Plays splash.mp4 fullscreen above the Capacitor WebView on COLD launch only.
/// The WebView stays hidden until this native controller finishes, so the home
/// screen cannot flash before the video starts.
final class SplashVideoViewController: UIViewController {

    static var didPlayThisProcess = false

    private static let playbackRate: Float = 2.0
    private static let defaultMaxOverlayDuration: TimeInterval = 6.0
    private static let fallbackPadding: TimeInterval = 1.0

    private var player: AVPlayer?
    private var playerLayer: AVPlayerLayer?
    private var endObserver: NSObjectProtocol?
    private var failedObserver: NSObjectProtocol?
    private var stallObserver: NSObjectProtocol?
    private var statusObservation: NSKeyValueObservation?
    private var timeObserver: Any?
    private var timeoutWork: DispatchWorkItem?
    private var onFinish: (() -> Void)?
    private var finished = false

    @discardableResult
    static func presentIfNeeded(over host: UIViewController, revealing webView: UIView?) -> Bool {
        guard !didPlayThisProcess else { return false }
        guard let url = Bundle.main.url(forResource: "splash", withExtension: "mp4") else {
            didPlayThisProcess = true
            webView?.alpha = 1
            return false
        }
        didPlayThisProcess = true

        webView?.alpha = 0

        let overlay = SplashVideoViewController()
        host.addChild(overlay)
        host.view.addSubview(overlay.view)
        overlay.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            overlay.view.leadingAnchor.constraint(equalTo: host.view.leadingAnchor),
            overlay.view.trailingAnchor.constraint(equalTo: host.view.trailingAnchor),
            overlay.view.topAnchor.constraint(equalTo: host.view.topAnchor),
            overlay.view.bottomAnchor.constraint(equalTo: host.view.bottomAnchor)
        ])
        overlay.didMove(toParent: host)

        overlay.start(url: url) { [weak overlay, weak webView] in
            webView?.alpha = 1
            UIView.animate(withDuration: 0.18, animations: {
                overlay?.view.alpha = 0
            }, completion: { _ in
                overlay?.willMove(toParent: nil)
                overlay?.view.removeFromSuperview()
                overlay?.removeFromParent()
            })
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
            forName: AVPlayerItem.didPlayToEndTimeNotification,
            object: item,
            queue: .main
        ) { [weak self] _ in
            self?.finish()
        }

        failedObserver = NotificationCenter.default.addObserver(
            forName: AVPlayerItem.failedToPlayToEndTimeNotification,
            object: item,
            queue: .main
        ) { [weak self] _ in
            self?.finish()
        }

        stallObserver = NotificationCenter.default.addObserver(
            forName: AVPlayerItem.playbackStalledNotification,
            object: item,
            queue: .main
        ) { [weak self] _ in
            self?.finish()
        }

        statusObservation = item.observe(\.status, options: [.initial, .new]) { [weak self] item, _ in
            if item.status == .failed { DispatchQueue.main.async { self?.finish() } }
        }

        timeObserver = player.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 0.05, preferredTimescale: 600),
            queue: .main
        ) { [weak self, weak item] currentTime in
            guard let self, let duration = item?.duration.seconds, duration.isFinite, duration > 0 else { return }
            if currentTime.seconds >= max(0, duration - 0.08) { self.finish() }
        }

        let naturalDuration = item.asset.duration.seconds
        let maxDuration = naturalDuration.isFinite && naturalDuration > 0
            ? min(Self.defaultMaxOverlayDuration, (naturalDuration / Double(Self.playbackRate)) + Self.fallbackPadding)
            : Self.defaultMaxOverlayDuration
        let work = DispatchWorkItem { [weak self] in self?.finish() }
        timeoutWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + maxDuration, execute: work)

        player.playImmediately(atRate: Self.playbackRate)
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
        if let obs = failedObserver {
            NotificationCenter.default.removeObserver(obs)
            failedObserver = nil
        }
        if let obs = stallObserver {
            NotificationCenter.default.removeObserver(obs)
            stallObserver = nil
        }
        if let observer = timeObserver {
            player?.removeTimeObserver(observer)
            timeObserver = nil
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
        if let obs = failedObserver {
            NotificationCenter.default.removeObserver(obs)
        }
        if let obs = stallObserver {
            NotificationCenter.default.removeObserver(obs)
        }
        if let observer = timeObserver {
            player?.removeTimeObserver(observer)
        }
        statusObservation?.invalidate()
        timeoutWork?.cancel()
    }
}
