package com.chhari.stack;

import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Typeface;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.TextView;
import androidx.core.content.ContextCompat;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.splashscreen.SplashScreenViewProvider;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** Set by SplashPlugin once the web app has painted its first screen. */
    static volatile boolean webReady = false;

    private static final long MAX_SPLASH_MS = 4000;
    // Let the logo animation (blocks dropping in, ~0.8 s) finish.
    private static final long MIN_SPLASH_MS = 850;
    // Then the tagline fades in under the logo and stays long enough to read.
    private static final long TAGLINE_MS = 1100;
    private static final String TAGLINE = "Stack makes you remember what you read.";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The animated Stack logo on the paper background (styles.xml), then the
        // tagline under it; kept up until the web app is ready so there's no
        // blank flash (about 2–4 s).
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        long start = SystemClock.uptimeMillis();
        webReady = false;
        splash.setKeepOnScreenCondition(() -> SystemClock.uptimeMillis() - start < MIN_SPLASH_MS);
        splash.setOnExitAnimationListener(view -> showTagline(view, start));

        // Phones stay portrait; tablets (600dp+) can rotate freely.
        boolean tablet = getResources().getConfiguration().smallestScreenWidthDp >= 600;
        setRequestedOrientation(tablet ? ActivityInfo.SCREEN_ORIENTATION_FULL_USER : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);

        registerPlugin(SplashPlugin.class);
        registerPlugin(AppSettingsPlugin.class);
        registerPlugin(PhoneFilesPlugin.class);
        registerPlugin(LocalMusicPlugin.class);
        registerPlugin(ShareInPlugin.class);
        registerPlugin(GoogleSignInPlugin.class);
        registerPlugin(BackupPlugin.class);
        registerPlugin(NewsAlertsPlugin.class);
        registerPlugin(WidgetPlugin.class);
        super.onCreate(savedInstanceState);
        // Opened by the share card's "Open in Stack" (not on a rotation/recreate).
        if (savedInstanceState == null) ShareInPlugin.handleOpen(getIntent());
    }

    /** Adds the tagline under the splash logo, then fades the splash out once the web app is ready. */
    private void showTagline(SplashScreenViewProvider provider, long start) {
        View icon = provider.getIconView();
        if (!(provider.getView() instanceof ViewGroup)) {
            provider.remove();
            return;
        }
        ViewGroup root = (ViewGroup) provider.getView();
        float dp = getResources().getDisplayMetrics().density;

        TextView line = new TextView(this);
        line.setText(TAGLINE);
        line.setTextColor(ContextCompat.getColor(this, R.color.splash_ink));
        line.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        line.setBreakStrategy(android.text.Layout.BREAK_STRATEGY_BALANCED);
        line.setTypeface(Typeface.create(Typeface.SERIF, Typeface.ITALIC));
        line.setGravity(Gravity.CENTER);
        int side = Math.round(24 * dp);
        line.setPadding(side, 0, side, 0);
        line.setAlpha(0f);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        if (icon != null && icon.getHeight() > 0) {
            // The logo's base block ends 65dp below the icon's centre (splash_icon.xml); sit under it.
            int[] at = new int[2];
            icon.getLocationInWindow(at);
            int[] rootAt = new int[2];
            root.getLocationInWindow(rootAt);
            lp.gravity = Gravity.TOP;
            lp.topMargin = at[1] - rootAt[1] + icon.getHeight() / 2 + Math.round((65 + 22) * dp);
        } else {
            // Android sometimes shows the splash without the logo (e.g. right after an update).
            lp.gravity = Gravity.CENTER_VERTICAL;
        }
        root.addView(line, lp);
        line.animate().alpha(1f).setDuration(350).start();

        Handler handler = new Handler(Looper.getMainLooper());
        long shownAt = SystemClock.uptimeMillis();
        Runnable check = new Runnable() {
            @Override
            public void run() {
                long now = SystemClock.uptimeMillis();
                boolean read = now - shownAt >= TAGLINE_MS;
                if ((read && webReady) || now - start >= MAX_SPLASH_MS) {
                    root.animate().alpha(0f).setDuration(250).withEndAction(provider::remove).start();
                } else {
                    handler.postDelayed(this, 50);
                }
            }
        };
        handler.post(check);
    }

    // "Open in Stack" while Stack was already running.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        ShareInPlugin.handleOpen(intent);
    }
}
