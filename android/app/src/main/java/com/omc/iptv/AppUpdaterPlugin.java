package com.omc.iptv;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

/**
 * Downloads a new APK inside the app and opens Android's installer. Android still asks the user to confirm the
 * install, and it only accepts the update if it is signed with the same key as the installed app.
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    @PluginMethod
    public void install(PluginCall call) {
        final String address = call.getString("url");
        final String expected = call.getString("sha256", "");
        if (address == null || !(address.startsWith("https://") || address.startsWith("http://"))) {
            call.reject("A valid url is required");
            return;
        }
        new Thread(() -> {
            try {
                Context context = getContext();
                File dir = new File(context.getCacheDir(), "updates");
                if (!dir.exists() && !dir.mkdirs()) throw new Exception("Could not create the download folder");
                File apk = new File(dir, "update.apk");

                HttpURLConnection conn = (HttpURLConnection) new URL(address).openConnection();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(30000);
                conn.connect();
                if (conn.getResponseCode() != 200) throw new Exception("Download failed: HTTP " + conn.getResponseCode());
                long total = conn.getContentLengthLong();
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(apk)) {
                    byte[] buffer = new byte[16384];
                    long done = 0;
                    int lastPercent = -1;
                    int n;
                    while ((n = in.read(buffer)) > 0) {
                        out.write(buffer, 0, n);
                        digest.update(buffer, 0, n);
                        done += n;
                        if (total > 0) {
                            int percent = (int) (done * 100 / total);
                            if (percent != lastPercent) {
                                lastPercent = percent;
                                JSObject progress = new JSObject();
                                progress.put("percent", percent);
                                notifyListeners("progress", progress);
                            }
                        }
                    }
                }
                if (!expected.isEmpty()) {
                    StringBuilder hex = new StringBuilder();
                    for (byte b : digest.digest()) hex.append(String.format("%02x", b));
                    if (!hex.toString().equalsIgnoreCase(expected)) {
                        //noinspection ResultOfMethodCallIgnored
                        apk.delete();
                        throw new Exception("CHECKSUM");
                    }
                }

                // Android 8+ asks the user to allow this app to install apps, once.
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.getPackageManager().canRequestPackageInstalls()) {
                    Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + context.getPackageName()));
                    settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(settings);
                    call.reject("PERMISSION");
                    return;
                }

                Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", apk);
                Intent install = new Intent(Intent.ACTION_VIEW);
                install.setDataAndType(uri, "application/vnd.android.package-archive");
                install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(install);
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage() == null ? "Update failed" : e.getMessage());
            }
        }).start();
    }
}
