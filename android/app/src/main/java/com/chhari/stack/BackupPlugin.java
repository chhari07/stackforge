package com.chhari.stack;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.content.ClipData;
import android.util.Base64;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Saves a Stack backup where the person chooses (Android's "Save to" picker),
 * written in pieces so a backup with PDFs never has to cross the bridge at once.
 * Also hands text and pictures (quote cards) to other apps. See
 * src/lib/backup.ts, export-md.ts and quote-card.ts.
 */
@CapacitorPlugin(name = "Backup")
public class BackupPlugin extends Plugin {

    @PluginMethod
    public void create(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("mime", "application/json"));
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("name", "stack-backup.json"));
        startActivityForResult(call, intent, "created");
    }

    @ActivityCallback
    private void created(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.reject("cancelled", "CANCELLED");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("uri", data.getData().toString());
        call.resolve(ret);
    }

    /** Writes text to the file: "wt" replaces it, "wa" adds to the end. */
    @PluginMethod
    public void write(PluginCall call) {
        String uri = call.getString("uri");
        String text = call.getString("text", "");
        boolean append = Boolean.TRUE.equals(call.getBoolean("append", false));
        if (uri == null) {
            call.reject("uri missing");
            return;
        }
        try (OutputStream out = getContext().getContentResolver().openOutputStream(Uri.parse(uri), append ? "wa" : "wt")) {
            if (out == null) throw new java.io.IOException("can't open file");
            out.write(text.getBytes(StandardCharsets.UTF_8));
            call.resolve();
        } catch (Exception e) {
            call.reject("write failed: " + e.getMessage());
        }
    }

    /** Hands text to another app (Obsidian, Notion, Keep, email…) through Android's share sheet. */
    @PluginMethod
    public void shareText(PluginCall call) {
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_SUBJECT, call.getString("title", "Stack notes"));
        send.putExtra(Intent.EXTRA_TEXT, call.getString("text", ""));
        Intent chooser = Intent.createChooser(send, call.getString("title", "Share"));
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(chooser);
        call.resolve();
    }

    /** Hands a PNG (base64 in "data") to another app, with "text" as its caption. The file sits in the app's cache, readable only by the app picked. */
    @PluginMethod
    public void shareImage(PluginCall call) {
        String data = call.getString("data");
        if (data == null) {
            call.reject("data missing");
            return;
        }
        try {
            File dir = new File(getContext().getCacheDir(), "shared");
            dir.mkdirs();
            // One card at a time: clear the last one.
            File[] old = dir.listFiles();
            if (old != null) for (File f : old) f.delete();
            String name = call.getString("name", "stack-quote.png").replaceAll("[^A-Za-z0-9._-]", "_");
            File file = new File(dir, name);
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(Base64.decode(data, Base64.DEFAULT));
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("image/png");
            send.putExtra(Intent.EXTRA_STREAM, uri);
            String text = call.getString("text");
            if (text != null && !text.isEmpty()) send.putExtra(Intent.EXTRA_TEXT, text);
            send.setClipData(ClipData.newRawUri("", uri));
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, call.getString("title", "Share"));
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getContext().startActivity(chooser);
            call.resolve();
        } catch (Exception e) {
            call.reject("share failed: " + e.getMessage());
        }
    }
}
