package com.chhari.stack;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Gives the home screen widget (StackWidget) what to show. See src/lib/widget.ts. */
@CapacitorPlugin(name = "Widget")
public class WidgetPlugin extends Plugin {

    /** { quote, source, quoteHref, reading, readingHref, streak } */
    @PluginMethod
    public void set(PluginCall call) {
        Context ctx = getContext();
        ctx.getSharedPreferences(StackWidget.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString("quote", call.getString("quote", ""))
            .putString("source", call.getString("source", ""))
            .putString("quoteHref", call.getString("quoteHref", "/review"))
            .putString("reading", call.getString("reading", ""))
            .putString("readingHref", call.getString("readingHref", "/library"))
            .putInt("streak", call.getInt("streak", 0))
            .apply();
        StackWidget.refresh(ctx);
        call.resolve();
    }

    /** { notes: a JSON list of { kind, text, quote, source, at, href } } */
    @PluginMethod
    public void setNotes(PluginCall call) {
        Context ctx = getContext();
        ctx.getSharedPreferences(NotesWidget.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString("notes", call.getString("notes", "[]"))
            .apply();
        NotesWidget.refresh(ctx);
        call.resolve();
    }

    /** Asks the home screen to add the today widget. */
    @PluginMethod
    public void pin(PluginCall call) {
        askToPin(call, StackWidget.class);
    }

    /** Asks the home screen to add the notes widget. */
    @PluginMethod
    public void pinNotes(PluginCall call) {
        askToPin(call, NotesWidget.class);
    }

    /** Android 8+, if the launcher allows it. */
    private void askToPin(PluginCall call, Class<?> widget) {
        JSObject ret = new JSObject();
        boolean asked = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AppWidgetManager mgr = AppWidgetManager.getInstance(getContext());
            if (mgr.isRequestPinAppWidgetSupported()) {
                asked = mgr.requestPinAppWidget(new ComponentName(getContext(), widget), null, null);
            }
        }
        ret.put("asked", asked);
        call.resolve(ret);
    }
}
