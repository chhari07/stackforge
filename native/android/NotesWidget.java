package com.chhari.stack;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.widget.RemoteViews;

/**
 * The notes widget: a scrolling list of pinned and recent notes, with a button
 * for a new note. The web app saves the list through WidgetPlugin (see
 * src/lib/widget.ts); NotesWidgetService draws its rows.
 */
public class NotesWidget extends AppWidgetProvider {

    static final String PREFS = "stack-notes-widget";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        mgr.updateAppWidget(ids, views(ctx));
        // Rows say "Today" or "Yesterday", so they need redrawing as days pass.
        mgr.notifyAppWidgetViewDataChanged(ids, R.id.notes_widget_list);
    }

    /** Redraws every notes widget on the home screen. */
    static void refresh(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, NotesWidget.class));
        if (ids.length == 0) return;
        mgr.updateAppWidget(ids, views(ctx));
        mgr.notifyAppWidgetViewDataChanged(ids, R.id.notes_widget_list);
    }

    static Uri link(String href) {
        return Uri.parse("com.chhari.stack://open?href=" + Uri.encode(href) + "&from=notes-widget");
    }

    private static RemoteViews views(Context ctx) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.stack_notes_widget);
        v.setRemoteAdapter(R.id.notes_widget_list, new Intent(ctx, NotesWidgetService.class));
        v.setEmptyView(R.id.notes_widget_list, R.id.notes_widget_empty);
        v.setOnClickPendingIntent(R.id.notes_widget_title, open(ctx, 110, "/notes"));
        v.setOnClickPendingIntent(R.id.notes_widget_empty, open(ctx, 110, "/notes"));
        v.setOnClickPendingIntent(R.id.notes_widget_add, open(ctx, 111, "/notes/edit"));

        // Each row fills in its own link (see NotesWidgetService), so this must stay mutable.
        Intent row = new Intent(Intent.ACTION_VIEW);
        row.setClass(ctx, MainActivity.class);
        row.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int mutable = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0;
        v.setPendingIntentTemplate(R.id.notes_widget_list,
            PendingIntent.getActivity(ctx, 112, row, mutable | PendingIntent.FLAG_UPDATE_CURRENT));
        return v;
    }

    private static PendingIntent open(Context ctx, int code, String href) {
        Intent open = new Intent(Intent.ACTION_VIEW, link(href));
        open.setClass(ctx, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, code, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
