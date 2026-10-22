package xyz.snowlit.draft;

import xyz.snowlit.failure.ApplicationFailure;
import java.util.Locale;

public enum DraftKind {
    ALBUM, DIARY, MOMENT, ALBUM_EDIT;

    public String path() { return name().toLowerCase(Locale.ROOT); }

    public static DraftKind fromPath(String path) {
        for (DraftKind kind : values()) if (kind != ALBUM_EDIT && kind.path().equals(path)) return kind;
        throw ApplicationFailure.notFound("DRAFT_KIND_INVALID", "草稿类型不存在");
    }
}
