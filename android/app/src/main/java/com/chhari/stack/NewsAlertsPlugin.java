package com.chhari.stack;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;

/**
 * Turns breaking-news alerts (NewsAlertWorker) on or off, for the feeds of the
 * topics you picked, and hands the app the stories saved with an alert's
 * "Save for later" button (NewsSaveReceiver).
 */
@CapacitorPlugin(name = "NewsAlerts")
public class NewsAlertsPlugin extends Plugin {

    private static final String WORK = "news-alerts";
    private static volatile NewsAlertsPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    /** A story was saved from an alert while Stack is running: the app picks it up now. */
    static void savedFromAlert() {
        NewsAlertsPlugin p = instance;
        if (p != null) p.notifyListeners("saved", new JSObject());
    }

    /** { on, feeds: [{ source, url, topic }], labels: { … the alert's words in the app's language } } */
    @PluginMethod
    public void configure(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        JSArray feeds = call.getArray("feeds", new JSArray());
        JSObject labels = call.getObject("labels", new JSObject());
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences(NewsAlertWorker.PREFS, Context.MODE_PRIVATE);
        SharedPreferences.Editor edit = prefs.edit().putBoolean("on", on).putString("labels", labels.toString());
        // New topics: start from what's there now instead of alerting on old stories.
        if (!feeds.toString().equals(prefs.getString("feeds", ""))) edit.putString("feeds", feeds.toString()).putLong("lastSeen", 0);
        edit.apply();

        WorkManager wm = WorkManager.getInstance(ctx);
        if (on && feeds.length() > 0) {
            NewsAlertWorker.ensureChannels(ctx);
            PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(NewsAlertWorker.class, 30, TimeUnit.MINUTES)
                .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build();
            wm.enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP, req);
        } else {
            wm.cancelUniqueWork(WORK);
        }
        call.resolve();
    }

    /** Shows the newest story now, to check alerts work. */
    @PluginMethod
    public void test(PluginCall call) {
        OneTimeWorkRequest req = new OneTimeWorkRequest.Builder(NewsAlertWorker.class)
            .setInputData(new Data.Builder().putBoolean("test", true).build())
            .build();
        WorkManager.getInstance(getContext()).enqueue(req);
        call.resolve();
    }

    /** The stories saved from alerts that the app hasn't added yet. They stay until ackSaves(). */
    @PluginMethod
    public void takeSaves(PluginCall call) {
        try {
            JSArray items = new JSArray(NewsSaveReceiver.inbox(getContext()).toString());
            JSObject out = new JSObject();
            out.put("items", items);
            call.resolve(out);
        } catch (Exception e) {
            call.reject("Couldn't read saved stories", e);
        }
    }

    /** { count }: the first `count` saved stories are in the Library now. */
    @PluginMethod
    public void ackSaves(PluginCall call) {
        int count = call.getInt("count", 0);
        NewsSaveReceiver.drop(getContext(), count);
        call.resolve();
    }
}
