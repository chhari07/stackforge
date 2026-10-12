package com.chhari.stack;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationChannelGroup;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Breaking-news alerts, run by WorkManager about every 30 minutes (see
 * NewsAlertsPlugin). Reads the RSS feeds of the topics you picked and, when a
 * story newer than anything seen before appears, shows one notification that
 * opens it in Stack's reader. At most one alert an hour, and the first check
 * only notes what's there, so turning alerts on never floods you.
 *
 * The alert: the topic on top ("AI news"), the headline as the title, the
 * story's own summary below it (never the headline again), the source and
 * time when pulled down, and Read / Save for later buttons. Each topic has its
 * own Android channel, so a topic can be silenced in the phone's settings. The
 * words come from the app in its language ("labels", see lib/news-alerts.ts).
 */
public class NewsAlertWorker extends Worker {

    static final String PREFS = "stack_news_alerts";
    private static final String OLD_CHANNEL = "news_alerts"; // one channel for every topic, before topic channels
    private static final String GROUP = "news";
    private static final long HOUR = 3_600_000L;
    private static final int NOTIFICATION_ID = 7301;

    public NewsAlertWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    private static final class Story {
        String source, title, link, summary, image, topic;
        long at;
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        boolean test = getInputData().getBoolean("test", false);
        if (!prefs.getBoolean("on", false) && !test) return Result.success();

        long lastSeen = prefs.getLong("lastSeen", 0);
        Story newest = null;
        long maxSeen = lastSeen;
        try {
            JSONArray feeds = new JSONArray(prefs.getString("feeds", "[]"));
            for (int i = 0; i < feeds.length(); i++) {
                JSONObject f = feeds.getJSONObject(i);
                String xml = fetch(f.getString("url"));
                if (xml == null) continue;
                for (Story s : parse(xml, f.getString("source"), f.optString("topic", "top"))) {
                    maxSeen = Math.max(maxSeen, s.at);
                    if ((test || s.at > lastSeen) && (newest == null || s.at > newest.at)) newest = s;
                }
            }
        } catch (Exception e) {
            return Result.retry();
        }

        long now = System.currentTimeMillis();
        prefs.edit().putLong("lastSeen", Math.min(maxSeen, now)).apply();
        if (newest == null) return Result.success();
        boolean firstCheck = lastSeen == 0;
        boolean recent = now - newest.at < 3 * HOUR;
        boolean quiet = now - prefs.getLong("lastNotified", 0) < HOUR;
        if (test || (!firstCheck && recent && !quiet)) {
            notify(ctx, newest, test);
            if (!test) prefs.edit().putLong("lastNotified", now).apply();
        }
        return Result.success();
    }

    private static String fetch(String url) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(10_000);
            c.setReadTimeout(10_000);
            c.setRequestProperty("User-Agent", "Mozilla/5.0 (compatible; Stack/0.1; news reader)");
            if (c.getResponseCode() != 200) return null;
            try (InputStream in = c.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buf = new byte[16384];
                int n;
                while ((n = in.read(buf)) > 0 && out.size() < 2_000_000) out.write(buf, 0, n);
                return out.toString("UTF-8");
            }
        } catch (Exception e) {
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static final Pattern ITEM = Pattern.compile("<item[\\s>][\\s\\S]*?</item>", Pattern.CASE_INSENSITIVE);

    private static String tag(String item, String name) {
        Matcher m = Pattern.compile("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", Pattern.CASE_INSENSITIVE).matcher(item);
        if (!m.find()) return null;
        return decode(m.group(1).replaceAll("<!\\[CDATA\\[|\\]\\]>", "")).replaceAll("<[^>]*>", " ").replaceAll("\\s+", " ").trim();
    }

    private static String decode(String s) {
        return s.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&apos;", "'").replace("&#39;", "'").replace("&nbsp;", " ").replace("&amp;", "&");
    }

    private static final Pattern IMAGE = Pattern.compile(
        "<(?:media:content|media:thumbnail|enclosure)[^>]*?url=\"(https://[^\"]+)\"", Pattern.CASE_INSENSITIVE);

    private static java.util.List<Story> parse(String xml, String source, String topic) {
        java.util.List<Story> out = new java.util.ArrayList<>();
        Matcher m = ITEM.matcher(xml);
        while (m.find() && out.size() < 15) {
            String item = m.group();
            Story s = new Story();
            s.source = source;
            s.topic = topic;
            s.title = tag(item, "title");
            s.link = tag(item, "link");
            if (s.link == null || s.link.isEmpty()) s.link = tag(item, "guid");
            s.at = date(tag(item, "pubDate"));
            if (s.title == null || s.link == null || !s.link.startsWith("https://") || s.at == 0) continue;
            // Same clean-up as the news list (lib/news.ts), so the story opens with the same id.
            if (s.link.contains("at_medium=RSS") || s.link.contains("traffic_source")) s.link = s.link.replaceAll("[?#].*$", "");
            s.summary = summary(tag(item, "description"), s.title);
            Matcher img = IMAGE.matcher(item);
            if (img.find()) s.image = decode(img.group(1));
            out.add(s);
        }
        return out;
    }

    /** The feed's summary, if it says more than the headline; at most about two lines. */
    private static String summary(String d, String title) {
        if (d == null || d.isEmpty()) return null;
        String a = d.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]+", " ").trim();
        String b = title.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]+", " ").trim();
        if (a.isEmpty() || a.equals(b) || b.startsWith(a)) return null;
        if (d.length() > 220) d = d.substring(0, 220).replaceAll("\\s+\\S*$", "") + "…";
        return d;
    }

    private static long date(String s) {
        if (s == null) return 0;
        for (String f : new String[] { "EEE, dd MMM yyyy HH:mm:ss Z", "EEE, dd MMM yyyy HH:mm:ss zzz", "EEE, d MMM yyyy HH:mm:ss Z" }) {
            try {
                Date d = new SimpleDateFormat(f, Locale.US).parse(s.trim());
                if (d != null) return d.getTime();
            } catch (Exception ignored) {}
        }
        return 0;
    }

    // ---- The alert's words, from the app in its language (NewsAlertsPlugin.configure) ----

    private static JSONObject labels(Context ctx) {
        try {
            return new JSONObject(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("labels", "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    static String label(Context ctx, String key, String fallback) {
        String v = labels(ctx).optString(key, "");
        return v.isEmpty() ? fallback : v;
    }

    /** "AI news", "भारत की ख़बरें"… */
    static String topicName(Context ctx, String topic) {
        JSONObject topics = labels(ctx).optJSONObject("topics");
        String v = topics == null ? "" : topics.optString(topic, "");
        if (!v.isEmpty()) return v;
        return topic.equals("ai") ? "AI news" : Character.toUpperCase(topic.charAt(0)) + topic.substring(1) + " news";
    }

    static String channelId(String topic) {
        return "news_" + topic;
    }

    /** One channel per topic picked, under a "News" group, named in the app's language. */
    static void ensureChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        nm.createNotificationChannelGroup(new NotificationChannelGroup(GROUP, label(ctx, "group", "News")));
        java.util.Set<String> topics = new java.util.LinkedHashSet<>();
        try {
            JSONArray feeds = new JSONArray(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("feeds", "[]"));
            for (int i = 0; i < feeds.length(); i++) topics.add(feeds.getJSONObject(i).optString("topic", "top"));
        } catch (Exception ignored) {}
        for (String topic : topics) ensureChannel(ctx, nm, topic);
        if (nm.getNotificationChannel(OLD_CHANNEL) != null) nm.deleteNotificationChannel(OLD_CHANNEL);
    }

    private static void ensureChannel(Context ctx, NotificationManager nm, String topic) {
        if (Build.VERSION.SDK_INT < 26) return;
        String name = topicName(ctx, topic);
        // Creating it again only renames it (after a language change); the reader's sound/silence choice stays.
        NotificationChannel ch = new NotificationChannel(channelId(topic), name, NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription(label(ctx, "channel", "New stories in {topic}").replace("{topic}", name));
        ch.setGroup(GROUP);
        nm.createNotificationChannel(ch);
    }

    private static void notify(Context ctx, Story s, boolean test) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        if (Build.VERSION.SDK_INT >= 26) ensureChannel(ctx, ctx.getSystemService(NotificationManager.class), s.topic);
        // Opens Stack's reader: com.chhari.stack://open?href=/read?id=web-<base64url of the link>
        String id = "web-" + Base64.encodeToString(s.link.getBytes(StandardCharsets.UTF_8), Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("com.chhari.stack://open?href=" + Uri.encode("/read?id=" + id)));
        open.setClass(ctx, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent read = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        // "Save for later": NewsSaveReceiver keeps it for the Library, without opening Stack.
        Intent save = new Intent(ctx, NewsSaveReceiver.class).setAction(NewsSaveReceiver.ACTION)
            .putExtra("id", id)
            .putExtra("title", s.title)
            .putExtra("source", s.source)
            .putExtra("summary", s.summary)
            .putExtra("url", s.link)
            .putExtra("topic", s.topic)
            .putExtra("image", s.image)
            .putExtra("notificationId", NOTIFICATION_ID);
        PendingIntent saveIt = PendingIntent.getBroadcast(ctx, 1, save, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        String topic = topicName(ctx, s.topic);
        String tap = label(ctx, "tap", "{source} · tap to read in Stack").replace("{source}", s.source);
        // Collapsed: topic · headline · summary. Pulled down: the summary, then the source.
        String text = s.summary != null ? s.summary : tap;
        String big = s.summary != null ? s.summary + "\n\n" + s.source : tap;
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, channelId(s.topic))
            .setSmallIcon(R.drawable.ic_stat_stack)
            .setLargeIcon(BitmapFactory.decodeResource(ctx.getResources(), R.drawable.stack_logo))
            .setColor(Color.parseColor("#0A8A3A"))
            .setContentTitle(s.title)
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().setBigContentTitle(s.title).bigText(big))
            .setSubText(test ? label(ctx, "test", "Test alert") + " · " + topic : topic)
            .setWhen(s.at)
            .setShowWhen(true)
            .setContentIntent(read)
            .addAction(0, label(ctx, "read", "Read"), read)
            .addAction(0, label(ctx, "save", "Save for later"), saveIt)
            .setGroup(GROUP)
            .setAutoCancel(true);
        try {
            NotificationManagerCompat.from(ctx).notify(NOTIFICATION_ID, b.build());
        } catch (SecurityException ignored) {}
    }
}
