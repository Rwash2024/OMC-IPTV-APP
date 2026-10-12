package com.omc.iptv;

import android.app.Activity;
import android.app.PictureInPictureParams;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Rational;
import android.view.Window;
import android.view.WindowManager;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Full-screen video mode for the player: landscape, system bars hidden, screen kept on, and the picture
 * extended under a camera notch. exit() puts everything back.
 */
@CapacitorPlugin(name = "Immersive")
public class ImmersivePlugin extends Plugin {

    // The screen direction the user picked in Settings. The player temporarily overrides it with landscape.
    private int baseOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;
    private boolean inPlayer = false;

    @PluginMethod
    public void enter(PluginCall call) {
        Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            inPlayer = true;
            activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
            Window window = activity.getWindow();
            WindowCompat.setDecorFitsSystemWindows(window, false);
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            controller.hide(WindowInsetsCompat.Type.systemBars());
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                window.getAttributes().layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void exit(PluginCall call) {
        Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            inPlayer = false;
            activity.setRequestedOrientation(baseOrientation);
            Window window = activity.getWindow();
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
            controller.show(WindowInsetsCompat.Type.systemBars());
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                window.getAttributes().layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT;
            }
            call.resolve();
        });
    }

    // mode: "auto" (follow the phone's rotation), "landscape" or "portrait".
    @PluginMethod
    public void setOrientation(PluginCall call) {
        String mode = call.getString("mode", "auto");
        switch (mode) {
            case "landscape": baseOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE; break;
            case "portrait": baseOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT; break;
            default: baseOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;
        }
        Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            if (!inPlayer) activity.setRequestedOrientation(baseOrientation);
            call.resolve();
        });
    }

    // A device id that survives reinstalling the app (it only changes on a factory reset), used for the free-trial and activation checks.
    @PluginMethod
    public void deviceId(PluginCall call) {
        String id = Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ANDROID_ID);
        JSObject out = new JSObject();
        out.put("id", id == null ? "" : id);
        call.resolve(out);
    }

    // Hands a stream to another player app (VLC, MX Player...) when the built-in player can't handle it.
    @PluginMethod
    public void openExternal(PluginCall call) {
        String url = call.getString("url");
        if (url == null) { call.reject("url is required"); return; }
        String title = call.getString("title", "");
        Intent view = new Intent(Intent.ACTION_VIEW);
        view.setDataAndType(Uri.parse(url), "video/*");
        view.putExtra("title", title);
        try {
            getActivity().startActivity(Intent.createChooser(view, title));
            call.resolve();
        } catch (Exception e) {
            call.reject("No player app found");
        }
    }

    // Small floating window so the video keeps playing while the user uses another app.
    @PluginMethod
    public void enterPip(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) { call.reject("Not supported"); return; }
        PictureInPictureParams params = new PictureInPictureParams.Builder().setAspectRatio(new Rational(16, 9)).build();
        getActivity().enterPictureInPictureMode(params);
        call.resolve();
    }
}
