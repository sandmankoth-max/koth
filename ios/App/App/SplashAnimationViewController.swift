import UIKit

/// Plays the splash animation fullscreen above the Capacitor WebView on COLD launch only.
/// The WebView stays hidden until this native controller finishes, so the home
/// screen cannot flash before the animation starts.
final class SplashVideoViewController: UIViewController {

    static var didPlayThisProcess = false

    private static let sourceFrameRate: TimeInterval = 15.0
    private static let playbackRate: TimeInterval = 2.0
    private static let fallbackDuration: TimeInterval = 2.8

    private let imageView = UIImageView()
    private var timeoutWork: DispatchWorkItem?
    private var onFinish: (() -> Void)?
    private var finished = false

    @discardableResult
    static func presentIfNeeded(over host: UIViewController, revealing webView: UIView?) -> Bool {
        guard !didPlayThisProcess else { return false }
        guard Bundle.main.url(forResource: "splash_001", withExtension: "jpg", subdirectory: "SplashFrames") != nil else {
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

        overlay.start { [weak overlay, weak webView] in
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

        imageView.backgroundColor = .black
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        view.addSubview(imageView)
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        imageView.frame = view.bounds
    }

    private func start(onFinish: @escaping () -> Void) {
        self.onFinish = onFinish

        let frameURLs = Bundle.main.urls(forResourcesWithExtension: "jpg", subdirectory: "SplashFrames")?.sorted {
            $0.lastPathComponent.localizedStandardCompare($1.lastPathComponent) == .orderedAscending
        } ?? []
        let frames = frameURLs.compactMap { UIImage(contentsOfFile: $0.path) }

        guard !frames.isEmpty else {
            finish()
            return
        }

        imageView.image = frames.first
        imageView.animationImages = frames
        imageView.animationRepeatCount = 1
        imageView.animationDuration = TimeInterval(frames.count) / (Self.sourceFrameRate * Self.playbackRate)
        imageView.startAnimating()

        let maxDuration = max(Self.fallbackDuration, imageView.animationDuration + 0.25)
        let work = DispatchWorkItem { [weak self] in self?.finish() }
        timeoutWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + maxDuration, execute: work)
    }

    private func finish() {
        guard !finished else { return }
        finished = true
        timeoutWork?.cancel()
        timeoutWork = nil
        imageView.stopAnimating()
        imageView.animationImages = nil
        let cb = onFinish
        onFinish = nil
        cb?()
    }

    deinit {
        timeoutWork?.cancel()
    }
}
