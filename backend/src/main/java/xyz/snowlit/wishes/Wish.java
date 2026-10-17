package xyz.snowlit.wishes;

import java.time.LocalDateTime;

public class Wish {

    private Long id;
    private String title;
    private String description;
    private String category;
    private boolean completed;
    private String imageUrl;
    private String locationName;
    private Double latitude;
    private Double longitude;
    private String note;
    private LocalDateTime expectedCompletedAt;
    private LocalDateTime completedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long lastOperatedByUserId;
    private LocalDateTime lastOperatedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public boolean isDone() {
        return completed;
    }

    public void setDone(boolean done) {
        this.completed = done;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public boolean isCompleted() {
        return completed;
    }

    public void setCompleted(boolean completed) {
        this.completed = completed;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public String getLocationName() {
        return locationName;
    }

    public void setLocationName(String locationName) {
        this.locationName = locationName;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public LocalDateTime getExpectedCompletedAt() {
        return expectedCompletedAt;
    }

    public void setExpectedCompletedAt(LocalDateTime expectedCompletedAt) {
        this.expectedCompletedAt = expectedCompletedAt;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(LocalDateTime completedAt) {
        this.completedAt = completedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Long getLastOperatedByUserId() {
        return lastOperatedByUserId;
    }

    public void setLastOperatedByUserId(Long lastOperatedByUserId) {
        this.lastOperatedByUserId = lastOperatedByUserId;
    }

    public LocalDateTime getLastOperatedAt() {
        return lastOperatedAt;
    }

    public void setLastOperatedAt(LocalDateTime lastOperatedAt) {
        this.lastOperatedAt = lastOperatedAt;
    }
}
