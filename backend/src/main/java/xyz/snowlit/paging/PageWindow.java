package xyz.snowlit.paging;

/**
 * A requested page clamped to sane bounds: missing or non-positive values fall back to page 1 and the
 * list's default size, and the size never exceeds the list's maximum.
 */
public record PageWindow(int page, int size) {

    public static PageWindow of(Integer page, Integer size, int defaultSize, int maxSize) {
        int resolvedPage = page == null || page < 1 ? 1 : page;
        int resolvedSize = size == null || size < 1 ? defaultSize : Math.min(size, maxSize);
        return new PageWindow(resolvedPage, resolvedSize);
    }

    public int offset() {
        return (page - 1) * size;
    }

    public boolean hasMore(long total) {
        return (long) page * size < total;
    }
}
