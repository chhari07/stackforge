package com.chhari.stack;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

/**
 * The home screen widget: today's highlight, the streak and the PDF in
 * progress. The web app keeps what it shows up to date through WidgetPlugin
 * (see src/lib/widget.ts); the widget only reads what was saved.
 */
public class StackWidget extends AppWidgetProvider {

    static final String PREFS = "stack-widget";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        mgr.updateAppWidget(ids, views(ctx));
    }

    /** Redraws every Stack widget on the home screen. */
    static void refresh(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, StackWidget.class));
        if (ids.length > 0) mgr.updateAppWidget(ids, views(ctx));
    }

    private static RemoteViews views(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String quote = p.getString("quote", "");
        String source = p.getString("source", "");
        String reading = p.getString("reading", "");
        int streak = p.getInt("streak", 0);

        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.stack_widget);
        boolean hasQuote = !quote.isEmpty();
        v.setTextViewText(R.id.widget_quote, hasQuote ? "“" + quote + "”" : "Highlight a line in Stack and it shows up here.");
        v.setTextViewText(R.id.widget_source, source);
        v.setViewVisibility(R.id.widget_source, source.isEmpty() ? View.GONE : View.VISIBLE);
        v.setTextViewText(R.id.widget_streak, streak > 1 ? streak + " days in a row" : "");
        v.setTextViewText(R.id.widget_reading, reading.isEmpty() ? "Add a book to pick up here" : "Continue · " + reading);

        v.setOnClickPendingIntent(R.id.widget_root, open(ctx, 0, "/"));
        v.setOnClickPendingIntent(R.id.widget_quote_box, open(ctx, 1, hasQuote ? p.getString("quoteHref", "/review") : "/news"));
        v.setOnClickPendingIntent(R.id.widget_reading, open(ctx, 2, reading.isEmpty() ? "/library" : p.getString("readingHref", "/library")));
        return v;
    }

    /** Opens Stack on a screen, the same way a breaking-news alert does. */
    private static PendingIntent open(Context ctx, int code, String href) {
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("com.chhari.stack://open?href=" + Uri.encode(href) + "&from=widget" + code));
        open.setClass(ctx, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, 100 + code, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
