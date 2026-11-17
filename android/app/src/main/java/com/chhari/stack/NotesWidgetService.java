package com.chhari.stack;

import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import java.util.Calendar;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Draws the rows of the notes widget from the list the web app saved. */
public class NotesWidgetService extends RemoteViewsService {

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Rows(getApplicationContext());
    }

    private static class Rows implements RemoteViewsFactory {
        private final Context ctx;
        private JSONArray notes = new JSONArray();

        Rows(Context ctx) { this.ctx = ctx; }

        @Override
        public void onDataSetChanged() {
            String saved = ctx.getSharedPreferences(NotesWidget.PREFS, Context.MODE_PRIVATE).getString("notes", "[]");
            try {
                notes = new JSONArray(saved);
            } catch (JSONException e) {
                notes = new JSONArray();
            }
        }

        @Override
        public RemoteViews getViewAt(int position) {
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.stack_notes_widget_row);
            JSONObject n = notes.optJSONObject(position);
            if (n == null) return v;

            boolean quote = n.optBoolean("quote");
            String source = n.optString("source");
            v.setTextViewText(R.id.notes_row_kind, n.optString("kind"));
            v.setTextViewText(quote ? R.id.notes_row_quote : R.id.notes_row_text, n.optString("text"));
            v.setViewVisibility(R.id.notes_row_quote, quote ? View.VISIBLE : View.GONE);
            v.setViewVisibility(R.id.notes_row_text, quote ? View.GONE : View.VISIBLE);
            v.setTextViewText(R.id.notes_row_meta, source.isEmpty() ? when(n.optLong("at")) : source);

            Intent fill = new Intent();
            fill.setData(NotesWidget.link(n.optString("href", "/notes")));
            v.setOnClickFillInIntent(R.id.notes_row, fill);
            return v;
        }

        /** Counts calendar days, so a note from last night is "Yesterday". */
        private static String when(long at) {
            long days = (startOfDay(System.currentTimeMillis()) - startOfDay(at) + 12 * 3600_000L) / 86_400_000L;
            if (days <= 0) return "Today";
            if (days == 1) return "Yesterday";
            return days + " days ago";
        }

        private static long startOfDay(long at) {
            Calendar c = Calendar.getInstance();
            c.setTimeInMillis(at);
            c.set(Calendar.HOUR_OF_DAY, 0);
            c.set(Calendar.MINUTE, 0);
            c.set(Calendar.SECOND, 0);
            c.set(Calendar.MILLISECOND, 0);
            return c.getTimeInMillis();
        }

        @Override public int getCount() { return notes.length(); }
        @Override public void onCreate() {}
        @Override public void onDestroy() {}
        @Override public RemoteViews getLoadingView() { return null; }
        @Override public int getViewTypeCount() { return 1; }
        @Override public long getItemId(int position) { return position; }
        @Override public boolean hasStableIds() { return false; }
    }
}
