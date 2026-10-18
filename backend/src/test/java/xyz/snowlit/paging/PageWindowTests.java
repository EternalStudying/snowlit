package xyz.snowlit.paging;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PageWindowTests {

    @Test
    void clampsMissingOrOutOfRangeValues() {
        assertThat(PageWindow.of(null, null, 8, 30)).isEqualTo(new PageWindow(1, 8));
        assertThat(PageWindow.of(0, -2, 8, 30)).isEqualTo(new PageWindow(1, 8));
        assertThat(PageWindow.of(3, 500, 8, 30)).isEqualTo(new PageWindow(3, 30));
    }

    @Test
    void derivesOffsetAndWhetherMorePagesExist() {
        PageWindow window = new PageWindow(2, 10);

        assertThat(window.offset()).isEqualTo(10);
        assertThat(window.hasMore(21)).isTrue();
        assertThat(window.hasMore(20)).isFalse();
    }
}
