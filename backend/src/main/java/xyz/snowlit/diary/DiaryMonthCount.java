package xyz.snowlit.diary;

public class DiaryMonthCount {

    private Integer year;
    private Integer month;
    private Integer count;

    public DiaryMonthCount() {
    }

    public DiaryMonthCount(Integer year, Integer month, Integer count) {
        this.year = year;
        this.month = month;
        this.count = count;
    }

    public Integer getYear() {
        return year;
    }

    public void setYear(Integer year) {
        this.year = year;
    }

    public Integer getMonth() {
        return month;
    }

    public void setMonth(Integer month) {
        this.month = month;
    }

    public Integer getCount() {
        return count;
    }

    public void setCount(Integer count) {
        this.count = count;
    }
}
