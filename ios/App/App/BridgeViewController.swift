import UIKit
import Capacitor

/// Custom bridge VC so the camera-preview plugin can render the native
/// AVFoundation layer BEHIND the WebView (toBack: true). Requires the
/// WebView itself to be non-opaque with a clear background — otherwise
/// the WebView paints over the camera and the user sees a grey screen.
class BridgeViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        webView?.isOpaque = false
        webView?.backgroundColor = .clear
        webView?.scrollView.backgroundColor = .clear
    }
}
