package xyz.snowlit.home;

import java.time.LocalDate;

public class Couple {

    private Long id;
    private String personA;
    private String personB;
    private LocalDate startDate;
    private LocalDate anniversaryDate;
    private String slogan;

    public Couple() {
    }

    public Couple(Long id, String personA, String personB, LocalDate startDate, LocalDate anniversaryDate, String slogan) {
        this.id = id;
        this.personA = personA;
        this.personB = personB;
        this.startDate = startDate;
        this.anniversaryDate = anniversaryDate;
        this.slogan = slogan;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getPersonA() {
        return personA;
    }

    public void setPersonA(String personA) {
        this.personA = personA;
    }

    public String getPersonB() {
        return personB;
    }

    public void setPersonB(String personB) {
        this.personB = personB;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getAnniversaryDate() {
        return anniversaryDate;
    }

    public void setAnniversaryDate(LocalDate anniversaryDate) {
        this.anniversaryDate = anniversaryDate;
    }

    public String getSlogan() {
        return slogan;
    }

    public void setSlogan(String slogan) {
        this.slogan = slogan;
    }
}
