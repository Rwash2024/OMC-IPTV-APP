package com.omc.iptv;

import android.app.Activity;
import android.app.PictureInPictureParams;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.media.AudioManager;
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
            WindowManager.LayoutParams lp = window.getAttributes();
            lp.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE;
            window.setAttributes(lp);
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

    // Screen brightness for the swipe gesture, 0..1. Only this app's window changes; exit() gives control back to the system setting.
    @PluginMethod
    public void getBrightness(PluginCall call) {
        Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            float b = activity.getWindow().getAttributes().screenBrightness;
            if (b < 0) {
                try { b = Settings.System.getInt(activity.getContentResolver(), Settings.System.SCREEN_BRIGHTNESS) / 255f; }
                catch (Exception e) { b = 0.5f; }
            }
            JSObject out = new JSObject();
            out.put("value", b);
            call.resolve(out);
        });
    }

    @PluginMethod
    public void setBrightness(PluginCall call) {
        final double value = Math.max(0.02, Math.min(1, call.getDouble("value", 0.5)));
        Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            Window window = activity.getWindow();
            WindowManager.LayoutParams lp = window.getAttributes();
            lp.screenBrightness = (float) value;
            window.setAttributes(lp);
            call.resolve();
        });
    }

    // Media volume for the swipe gesture, 0..1 (the same volume the phone's side buttons change).
    @PluginMethod
    public void getVolume(PluginCall call) {
        AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        int max = Math.max(1, am.getStreamMaxVolume(AudioManager.STREAM_MUSIC));
        JSObject out = new JSObject();
        out.put("value", am.getStreamVolume(AudioManager.STREAM_MUSIC) / (double) max);
        call.resolve(out);
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        double value = Math.max(0, Math.min(1, call.getDouble("value", 0.5)));
        AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        int max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        am.setStreamVolume(AudioManager.STREAM_MUSIC, (int) Math.round(value * max), 0);
        call.resolve();
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
