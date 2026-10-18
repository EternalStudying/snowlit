package xyz.snowlit.diary;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DiaryMarkdownTests {

    @Test
    void readsTitleSummaryAndImagesInOrderWithoutDuplicates() {
        DiaryMarkdown content = DiaryMarkdown.read("""

                # 今天的 **光**

                傍晚去了[海边](https://example.com)，风很轻。
                ![a](https://cdn.test/a.png "海")
                <img src="https://cdn.test/b.webp" alt="b">
                ![again](https://cdn.test/a.png)
                """);

        assertThat(content.markdown()).startsWith("# 今天的");
        assertThat(content.title()).isEqualTo("今天的 光");
        assertThat(content.summary()).isEqualTo("傍晚去了，风很轻。");
        assertThat(content.imageUrls()).containsExactly("https://cdn.test/a.png", "https://cdn.test/b.webp");
    }

    @Test
    void untitledDiaryAndLongTextAreBounded() {
        DiaryMarkdown content = DiaryMarkdown.read("没有标题" + "很长".repeat(100));

        assertThat(content.title()).isEqualTo("未命名日记");
        assertThat(content.summary()).hasSize(120);
        assertThat(content.imageUrls()).isEmpty();
    }
}
