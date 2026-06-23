import UIKit
import Capacitor

/// Custom bridge VC so the camera-preview plugin can render the native
/// AVFoundation layer BEHIND the WebView (toBack: true). Requires the
/// WebView itself to be non-opaque with a clear background — otherwise
/// the WebView paints over the camera and the user sees a grey screen.
class BridgeViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        configureTransparentWebView()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        configureTransparentWebView()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        configureTransparentWebView()
    }

    private func configureTransparentWebView() {
        view.backgroundColor = .clear
        webView?.isOpaque = false
        webView?.backgroundColor = .clear
        webView?.superview?.backgroundColor = .clear
        webView?.scrollView.isOpaque = false
        webView?.scrollView.backgroundColor = .clear
    }
}
