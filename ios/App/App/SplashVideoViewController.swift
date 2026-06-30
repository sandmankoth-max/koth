import UIKit
import AVFoundation

/// Plays splash.mp4 fullscreen above the Capacitor WebView on COLD launch only.
///
/// Flow: native LaunchScreen → this video (first frame matches the
/// LaunchScreen for a seamless cut) → web view revealed when playback ends.
///
/// `didPlayThisProcess` is a process-lifetime flag, so backgrounding and
/// returning to the app never replays the video — only a true cold launch
/// (process re-spawn) resets it.
final class SplashVideoViewController: UIViewController {

    static var didPlayThisProcess = false

    private var player: AVPlayer?
    private var playerLayer: AVPlayerLayer?
    private var endObserver: NSObjectProtocol?
    private var onFinish: (() -> Void)?

    /// Attach a fullscreen splash overlay to the given host view and play
    /// splash.mp4 once. Returns `false` if the video already played in this
    /// process or the asset is missing — caller should proceed normally.
    @discardableResult
    static func presentIfNeeded(over host: UIView) -> Bool {
        guard !didPlayThisProcess else { return false }
        guard let url = Bundle.main.url(forResource: "splash", withExtension: "mp4") else {
            didPlayThisProcess = true
            return false
        }
        didPlayThisProcess = true

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
        return true
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        playerLayer?.frame = view.bounds
    }

    private func start(url: URL, onFinish: @escaping () -> Void) {
        self.onFinish = onFinish

        // Allow playback even if the user has the silent switch on.
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

        player.play()
    }

    private func finish() {
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
    }
}
