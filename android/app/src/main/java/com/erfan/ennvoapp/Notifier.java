package com.erfan.ennvoapp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import android.util.Base64;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.app.RemoteInput;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Single source of truth for every Ennvo notification.
 *
 * Web bridge notifications and FCM pushes both end up here, so a message is
 * shown exactly once, with the sender's photo, a working Reply action and a
 * tap target that opens the right chat instead of the reels feed.
 */
public class Notifier {
    static volatile boolean foreground = false;
    static volatile MainActivity activity = null;

    static final String MSG_CH = "app_messages";
    static final String CALL_CH = "app_calls";
    static final String ACT_CH = "app_activity";
    static final int CALL_ID = 9001;
    static final int SECRET_ID = 9003;
    static final String APP = "Ennvo";
    static final int ACCENT = Color.parseColor("#0A84FF");

    private static long lastSecret = 0;
    private static String lastKey = "";
    private static long lastTime = 0;
    private static final Map<Integer, Conv> convs = new HashMap<>();
    // Activity notifications each need their own PendingIntent, otherwise
    // FLAG_UPDATE_CURRENT makes every like/comment open the newest target.
    private static final AtomicInteger nextActivity = new AtomicInteger(0);

    static class Msg {
        final String text;
        final long ts = System.currentTimeMillis();
        final boolean mine;

        Msg(String t, boolean m) {
            text = t;
            mine = m;
        }
    }

    static class Conv {
        String title = "";
        String convId = "";
        Bitmap avatar;
        final List<Msg> msgs = new ArrayList<>();
    }

    static void channels(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        NotificationChannel messages = new NotificationChannel(MSG_CH, "Messages", NotificationManager.IMPORTANCE_HIGH);
        messages.enableVibration(true);
        messages.setVibrationPattern(new long[]{0, 120, 80, 120});
        messages.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        nm.createNotificationChannel(messages);

        NotificationChannel calls = new NotificationChannel(CALL_CH, "Calls", NotificationManager.IMPORTANCE_HIGH);
        AudioAttributes ringtone = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        calls.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE), ringtone);
        calls.enableVibration(true);
        calls.setVibrationPattern(new long[]{0, 800, 600, 800});
        calls.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        calls.setBypassDnd(true);
        nm.createNotificationChannel(calls);

        NotificationChannel activityChannel = new NotificationChannel(ACT_CH, "Activity", NotificationManager.IMPORTANCE_DEFAULT);
        activityChannel.enableVibration(true);
        nm.createNotificationChannel(activityChannel);

        if (Build.VERSION.SDK_INT >= 29) {
            NotificationChannel ongoing = new NotificationChannel(CallService.CH, "Ongoing call", NotificationManager.IMPORTANCE_LOW);
            ongoing.setShowBadge(false);
            nm.createNotificationChannel(ongoing);
        }
    }

    private static String norm(String s) {
        StringBuilder b = new StringBuilder();
        if (s != null) {
            for (int i = 0; i < s.length(); i++) {
                char c = s.charAt(i);
                if (Character.isLetterOrDigit(c)) b.append(Character.toLowerCase(c));
            }
        }
        return b.toString();
    }

    private static String clean(String s) {
        if (s == null) return "";
        int last = -1;
        for (int i = 0; i < s.length(); i++) {
            if (Character.isLetterOrDigit(s.charAt(i))) last = i;
        }
        return last < 0 ? s : s.substring(0, last + 1).trim();
    }

    // ------------------------------------------------------------------
    // Messages
    // ------------------------------------------------------------------
    static void showMessage(final Context ctx, String title, String body, final String avatarUrl, String convId) {
        if (foreground) return;
        String mode = ctx.getSharedPreferences("app", Context.MODE_PRIVATE).getString("notif_mode", "on");
        if ("off".equals(mode)) return;
        if ("secret".equals(mode)) {
            showSecret(ctx);
            return;
        }

        final String t = clean(title == null ? "" : title);
        final String b = body == null ? "" : body;
        final String cid = convId == null ? "" : convId;
        final int id = cid.isEmpty() ? ("c:" + norm(t)).hashCode() : ("cid:" + cid).hashCode();
        final String key = norm(t) + "|" + norm(b);

        synchronized (Notifier.class) {
            long now = System.currentTimeMillis();
            if (key.equals(lastKey) && now - lastTime < 15000) {
                Conv dup = convs.get(id);
                if (dup != null && dup.convId.isEmpty() && !cid.isEmpty()) {
                    dup.convId = cid;
                    repost(ctx, id, false);
                }
                return;
            }
            lastKey = key;
            lastTime = now;
        }

        new Thread(() -> {
            Bitmap avatar = loadAvatar(avatarUrl);
            synchronized (Notifier.class) {
                Conv c = convs.get(id);
                if (c == null) {
                    c = new Conv();
                    convs.put(id, c);
                }
                c.title = t;
                if (!cid.isEmpty()) c.convId = cid;
                if (avatar != null) c.avatar = avatar;
                c.msgs.add(new Msg(b, false));
                while (c.msgs.size() > 8) c.msgs.remove(0);
            }
            repost(ctx, id, true);
        }).start();
    }

    private static void showSecret(Context ctx) {
        synchronized (Notifier.class) {
            long now = System.currentTimeMillis();
            if (now - lastSecret < 4000) return;
            lastSecret = now;
        }
        channels(ctx);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, MSG_CH)
                .setSmallIcon(smallIcon(ctx))
                .setColor(ACCENT)
                .setContentTitle(APP)
                .setContentText("You have a new message")
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setDefaults(NotificationCompat.DEFAULT_SOUND)
                .setContentIntent(open(ctx, SECRET_ID, "", "", ""));
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(SECRET_ID, b.build());
    }

    static synchronized void repost(Context ctx, int id, boolean alert) {
        Conv c = convs.get(id);
        if (c == null || c.msgs.isEmpty()) return;
        channels(ctx);

        Person me = new Person.Builder().setName("You").build();
        String shortcutId = "conv_" + id;
        Person.Builder person = new Person.Builder().setName(c.title).setKey(shortcutId).setImportant(true);
        if (c.avatar != null) person.setIcon(IconCompat.createWithBitmap(c.avatar));
        Person other = person.build();

        try {
            Intent shortcutIntent = new Intent(ctx, MainActivity.class).setAction("app.OPEN")
                    .putExtra("open_conv", c.convId).putExtra("open_name", c.title);
            ShortcutInfoCompat.Builder shortcut = new ShortcutInfoCompat.Builder(ctx, shortcutId)
                    .setLongLived(true)
                    .setShortLabel(c.title)
                    .setIntent(shortcutIntent)
                    .setPerson(other);
            if (c.avatar != null) shortcut.setIcon(IconCompat.createWithBitmap(c.avatar));
            ShortcutManagerCompat.pushDynamicShortcut(ctx, shortcut.build());
        } catch (Exception ignored) { }

        NotificationCompat.MessagingStyle style = new NotificationCompat.MessagingStyle(me);
        for (Msg m : c.msgs) {
            style.addMessage(m.text, m.ts, m.mine ? me : other);
        }

        RemoteInput input = new RemoteInput.Builder("reply_text").setLabel("Reply").build();
        Intent replyIntent = new Intent(ctx, ReplyReceiver.class).setAction("reply").putExtra("id", id);
        PendingIntent replyPi = PendingIntent.getBroadcast(ctx, id, replyIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0));
        NotificationCompat.Action reply = new NotificationCompat.Action.Builder(
                android.R.drawable.ic_menu_send, "Reply", replyPi)
                .addRemoteInput(input)
                .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY)
                .setShowsUserInterface(false)
                .build();

        Intent dismissIntent = new Intent(ctx, ReplyReceiver.class).setAction("dismiss").putExtra("id", id);
        PendingIntent dismissPi = PendingIntent.getBroadcast(ctx, id + 1, dismissIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, MSG_CH)
                .setSmallIcon(smallIcon(ctx))
                .setColor(ACCENT)
                .setStyle(style)
                .setContentTitle(c.title)
                .setContentText(c.msgs.get(c.msgs.size() - 1).text)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setOnlyAlertOnce(!alert)
                .setDefaults(NotificationCompat.DEFAULT_SOUND)
                .addAction(reply)
                .setShortcutId(shortcutId)
                .setContentIntent(open(ctx, id, c.convId, c.title, ""))
                .setDeleteIntent(dismissPi);
        if (c.avatar != null) b.setLargeIcon(c.avatar);

        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(id, b.build());
    }

    static void handleReply(Context ctx, int id, String text) {
        String convId = "";
        String title = "";
        synchronized (Notifier.class) {
            Conv c = convs.get(id);
            if (c != null) {
                convId = c.convId;
                title = c.title;
                c.msgs.add(new Msg(text, true));
            }
        }
        MainActivity main = activity;
        if (main != null) {
            main.runJs("(window.__replyQ=window.__replyQ||[]).push({c:" + JSONObject.quote(convId)
                    + ",t:" + JSONObject.quote(text) + ",n:" + JSONObject.quote(title)
                    + "});window.__flushReplies&&window.__flushReplies();");
        } else {
            queue(ctx, convId, text, title);
        }
        repost(ctx, id, false);
    }

    static synchronized void forget(int id) {
        convs.remove(id);
    }

    static synchronized void clearMessages(Context ctx) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        nm.cancel(SECRET_ID);
        for (Integer id : convs.keySet()) nm.cancel(id);
        convs.clear();
    }

    // ------------------------------------------------------------------
    // Calls
    // ------------------------------------------------------------------
    static void showCall(final Context ctx, final String name, final String avatarUrl, final String type, final String callId) {
        if (foreground) return;
        channels(ctx);
        new Thread(() -> {
            Bitmap avatar = loadAvatar(avatarUrl);
            String caller = name == null ? "Ennvo User" : name;
            String id = callId == null ? "" : callId;

            PendingIntent screen = callIntent(ctx, 77, "open", id, caller, type, avatar);
            PendingIntent answer = callIntent(ctx, 78, "answer", id, caller, type, avatar);
            PendingIntent decline = PendingIntent.getBroadcast(ctx, 79,
                    new Intent(ctx, ReplyReceiver.class)
                            .setAction("decline_native")
                            .putExtra("call_id", id),
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            Person.Builder person = new Person.Builder().setName(caller).setImportant(true);
            if (avatar != null) person.setIcon(IconCompat.createWithBitmap(avatar));

            NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CALL_CH)
                    .setSmallIcon(smallIcon(ctx))
                    .setColor(ACCENT)
                    .setContentTitle(caller)
                    .setContentText("video".equals(type) ? "Incoming video call" : "Incoming voice call")
                    .setCategory(NotificationCompat.CATEGORY_CALL)
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE))
                    .setOngoing(true)
                    .setTimeoutAfter(45000)
                    .setStyle(NotificationCompat.CallStyle.forIncomingCall(person.build(), decline, answer))
                    .setFullScreenIntent(screen, true)
                    .setContentIntent(screen);
            if (avatar != null) b.setLargeIcon(avatar);

            Notification notification = b.build();
            notification.flags |= Notification.FLAG_INSISTENT;
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(CALL_ID, notification);
        }).start();
    }

    private static PendingIntent callIntent(Context ctx, int code, String action, String callId, String name, String type, String avatar) {
        Intent intent = new Intent(ctx, CallActivity.class)
                .setAction("app.CALL." + action)
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra("call_action", action)
                .putExtra("call_id", callId == null ? "" : callId)
                .putExtra("call_name", name == null ? "" : name)
                .putExtra("call_type", type == null ? "voice" : type)
                .putExtra("call_avatar", avatar == null ? "" : avatar);
        return PendingIntent.getActivity(ctx, code, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void cancelCall(Context ctx) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(CALL_ID);
    }

    // ------------------------------------------------------------------
    // Activity (likes, comments, follows)
    // ------------------------------------------------------------------
    static void showActivity(final Context ctx, final String title, final String body, final String avatarUrl, final String url) {
        if (foreground) return;
        String mode = ctx.getSharedPreferences("app", Context.MODE_PRIVATE).getString("notif_mode", "on");
        if ("off".equals(mode)) return;
        final boolean secret = "secret".equals(mode);
        channels(ctx);

        new Thread(() -> {
            Bitmap avatar = secret ? null : loadAvatar(avatarUrl);
            final String safeUrl = url == null ? "" : url;
            final int notificationId = 20_000 + Math.floorMod(nextActivity.getAndIncrement(), 70_000);
            // Request codes live in a different range than notification ids so
            // this PendingIntent can never collide with a chat's tap target.
            final int requestCode = 1_000_000 + Math.floorMod(notificationId, 500_000);
            NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, ACT_CH)
                    .setSmallIcon(smallIcon(ctx))
                    .setColor(ACCENT)
                    .setContentTitle(secret ? APP : clean(title == null ? APP : title))
                    .setContentText(secret ? "You have a new notification" : (body == null ? "" : body))
                    .setCategory(NotificationCompat.CATEGORY_SOCIAL)
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                    .setAutoCancel(true)
                    .setOnlyAlertOnce(false)
                    .setContentIntent(open(ctx, requestCode, "", "", safeUrl));
            if (avatar != null) b.setLargeIcon(avatar);
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.notify(notificationId, b.build());
            }
        }).start();
    }

    // ------------------------------------------------------------------
    // Tokens, pending replies, auth token
    // ------------------------------------------------------------------
    static void saveToken(Context ctx, String token) {
        ctx.getSharedPreferences("app", Context.MODE_PRIVATE).edit().putString("fcm", token).apply();
        MainActivity main = activity;
        if (main != null) main.runJs("window.onFcmToken&&window.onFcmToken(" + JSONObject.quote(token) + ")");
    }

    static void saveAuth(Context ctx, String uid, String token) {
        long exp = 0;
        try {
            String payload = token.split("\\.")[1];
            byte[] decoded = Base64.decode(payload, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
            exp = new JSONObject(new String(decoded, "UTF-8")).optLong("exp", 0) * 1000L;
        } catch (Exception ignored) { }
        ctx.getSharedPreferences("app", Context.MODE_PRIVATE).edit()
                .putString("auth_uid", uid == null ? "" : uid)
                .putString("auth_token", token == null ? "" : token)
                .putLong("auth_exp", exp)
                .apply();
    }

    static boolean hasFreshAuth(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences("app", Context.MODE_PRIVATE);
        String token = sp.getString("auth_token", "");
        long exp = sp.getLong("auth_exp", 0);
        return !token.isEmpty() && exp > System.currentTimeMillis() + 30000L;
    }

    /**
     * Decline a call straight from the notification, with no WebView at all.
     * Uses the Firebase ID token the app stored on its last launch.
     */
    static void declineNative(Context ctx, String callId) {
        if (callId == null || callId.isEmpty()) return;
        SharedPreferences sp = ctx.getSharedPreferences("app", Context.MODE_PRIVATE);
        String token = sp.getString("auth_token", "");
        if (token.isEmpty()) return;
        try {
            URL url = new URL("https://firestore.googleapis.com/v1/projects/ennvo-6c01c/databases/(default)/documents/calls/"
                    + callId + "?updateMask.fieldPaths=status");
            HttpURLConnection h = (HttpURLConnection) url.openConnection();
            h.setRequestMethod("PATCH");
            h.setConnectTimeout(3500);
            h.setReadTimeout(3500);
            h.setDoOutput(true);
            h.setRequestProperty("Content-Type", "application/json");
            h.setRequestProperty("Authorization", "Bearer " + token);
            h.getOutputStream().write(("{\"fields\":{\"status\":{\"stringValue\":\"rejected\"}}}").getBytes("UTF-8"));
            h.getResponseCode();
            h.disconnect();
        } catch (Exception e) {
            Log.w("Ennvo", "Native decline failed", e);
        }
    }

    static synchronized void queue(Context ctx, String c, String t, String n) {
        try {
            SharedPreferences sp = ctx.getSharedPreferences("app", Context.MODE_PRIVATE);
            JSONArray a = new JSONArray(sp.getString("pending", "[]"));
            a.put(new JSONObject().put("c", c).put("t", t).put("n", n));
            sp.edit().putString("pending", a.toString()).apply();
        } catch (Exception ignored) { }
    }

    static synchronized String takePending(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences("app", Context.MODE_PRIVATE);
        String s = sp.getString("pending", "[]");
        sp.edit().remove("pending").apply();
        return s;
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------
    static int smallIcon(Context ctx) {
        int r = ctx.getResources().getIdentifier("ic_stat_notify", "drawable", ctx.getPackageName());
        return r != 0 ? r : android.R.drawable.stat_notify_chat;
    }

    private static PendingIntent open(Context ctx, int code, String convId, String name, String url) {
        Intent intent = new Intent(ctx, MainActivity.class).setAction("app.OPEN")
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra("open_conv", convId == null ? "" : convId)
                .putExtra("open_name", name == null ? "" : name);
        if (url != null && !url.isEmpty()) intent.putExtra("open_url", url);
        return PendingIntent.getActivity(ctx, code, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static Bitmap loadAvatar(String u) {
        if (u == null || !u.startsWith("http")) return null;
        try {
            HttpURLConnection h = (HttpURLConnection) new URL(u).openConnection();
            h.setConnectTimeout(4000);
            h.setReadTimeout(4000);
            InputStream in = h.getInputStream();
            Bitmap src = BitmapFactory.decodeStream(in);
            in.close();
            if (src == null) return null;

            int size = Math.min(src.getWidth(), src.getHeight());
            Rect from = new Rect((src.getWidth() - size) / 2, (src.getHeight() - size) / 2,
                    (src.getWidth() + size) / 2, (src.getHeight() + size) / 2);
            Bitmap out = Bitmap.createBitmap(160, 160, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(out);
            Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
            canvas.drawCircle(80, 80, 80, paint);
            paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
            canvas.drawBitmap(src, from, new Rect(0, 0, 160, 160), paint);
            return out;
        } catch (Exception e) {
            return null;
        }
    }
}
