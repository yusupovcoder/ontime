package app.ontime.planner;

import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        matchWebViewBackground();
        preferHighRefreshRate();
    }

    @Override
    public void onResume() {
        super.onResume();
        preferHighRefreshRate();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        matchWebViewBackground();
    }

    /**
     * Просим у системы самый плавный режим экрана (90/120/144 Гц) при текущем разрешении.
     * Многие телефоны держат приложения на 60 Гц, пока приложение само не попросит больше.
     */
    private void preferHighRefreshRate() {
        try {
            Window window = getWindow();
            Display display = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R ? getDisplay() : getWindowManager().getDefaultDisplay();
            if (window == null || display == null) return;
            Display.Mode current = display.getMode();
            Display.Mode best = current;
            for (Display.Mode mode : display.getSupportedModes()) {
                boolean sameSize = mode.getPhysicalWidth() == current.getPhysicalWidth() && mode.getPhysicalHeight() == current.getPhysicalHeight();
                if (sameSize && mode.getRefreshRate() > best.getRefreshRate() + 0.5f) best = mode;
            }
            WindowManager.LayoutParams lp = window.getAttributes();
            boolean changed = false;
            if (lp.preferredDisplayModeId != best.getModeId()) {
                lp.preferredDisplayModeId = best.getModeId();
                changed = true;
            }
            if (lp.preferredRefreshRate != best.getRefreshRate()) {
                lp.preferredRefreshRate = best.getRefreshRate();
                changed = true;
            }
            if (changed) window.setAttributes(lp);
        } catch (Exception ignored) {
            // режим экрана — пожелание, а не обязательное условие
        }
    }

    /** Фон WebView до первой отрисовки страницы — как у приложения, чтобы не было вспышки. */
    private void matchWebViewBackground() {
        try {
            boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
            int bg = night ? Color.BLACK : Color.rgb(0xF2, 0xF2, 0xF7);
            if (getBridge() != null) {
                WebView wv = getBridge().getWebView();
                if (wv != null) wv.setBackgroundColor(bg);
            }
            getWindow().getDecorView().setBackgroundColor(bg);
        } catch (Exception ignored) {
        }
    }
}
