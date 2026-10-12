package com.chhari.stack;

import android.Manifest;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * "Save for later" on a breaking-news alert. Stack's Library lives in the app
 * (IndexedDB), so the story waits in a small inbox here and the app adds it,
 * with an offline copy, as soon as it runs (NewsAlertsPlugin.takeSaves). The
 * alert turns into a short "Saved" note, without opening Stack.
 */
public class NewsSaveReceiver extends BroadcastReceiver {

    static final String ACTION = "com.chhari.stack.SAVE_NEWS";
    private static final String PREFS = "stack_news_saves";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (!ACTION.equals(intent.getAction())) return;
        String id = intent.getStringExtra("id");
        String title = intent.getStringExtra("title");
        if (id == null || title == null) return;
        String topic = intent.getStringExtra("topic");
        try {
            JSONObject item = new JSONObject()
                .put("id", id)
                .put("title", title)
                .put("source", nz(intent.getStringExtra("source")))
                .put("summary", nz(intent.getStringExtra("summary")))
                .put("url", nz(intent.getStringExtra("url")))
                .put("topic", nz(topic))
                .put("image", nz(intent.getStringExtra("image")))
                .put("at", System.currentTimeMillis());
            add(ctx, item);
        } catch (Exception e) {
            return;
        }
        showSaved(ctx, intent.getIntExtra("notificationId", 0), title, topic == null ? "top" : topic);
        NewsAlertsPlugin.savedFromAlert();
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    static synchronized JSONArray inbox(Context ctx) {
        try {
            return new JSONArray(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("inbox", "[]"));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    private static synchronized void add(Context ctx, JSONObject item) throws Exception {
        JSONArray list = inbox(ctx);
        // Saved twice from the same alert: keep one.
        for (int i = 0; i < list.length(); i++) if (item.getString("id").equals(list.getJSONObject(i).optString("id"))) return;
        list.put(item);
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("inbox", list.toString()).apply();
    }

    static synchronized void drop(Context ctx, int count) {
        JSONArray list = inbox(ctx);
        JSONArray rest = new JSONArray();
        for (int i = Math.max(0, count); i < list.length(); i++) rest.put(list.opt(i));
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("inbox", rest.toString()).commit();
    }

    /** Replaces the alert with "Saved to your Library · In AI news · readable offline", which goes away by itself. */
    private static void showSaved(Context ctx, int notificationId, String title, String topic) {
        if (notificationId == 0) return;
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("com.chhari.stack://open?href=" + Uri.encode("/library")));
        open.setClass(ctx, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, notificationId + 2, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        String topicName = NewsAlertWorker.topicName(ctx, topic);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, NewsAlertWorker.channelId(topic))
            .setSmallIcon(R.drawable.ic_stat_stack)
            .setLargeIcon(BitmapFactory.decodeResource(ctx.getResources(), R.drawable.stack_logo))
            .setColor(Color.parseColor("#0A8A3A"))
            .setContentTitle(NewsAlertWorker.label(ctx, "saved", "Saved to your Library"))
            .setContentText(title)
            .setSubText(NewsAlertWorker.label(ctx, "savedIn", "In {topic} · readable offline").replace("{topic}", topicName))
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setContentIntent(pi)
            .setAutoCancel(true)
            .setTimeoutAfter(6000);
        try {
            NotificationManagerCompat.from(ctx).notify(notificationId, b.build());
        } catch (SecurityException ignored) {}
    }
}
