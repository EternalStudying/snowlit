package xyz.snowlit.album;

import java.time.LocalDate;

public class AlbumPhoto {

    private Long id;
    private Long albumId;
    private String caption;
    private String description;
    private LocalDate takenAt;
    private String location;
    private int sortOrder;
    private int width;
    private int height;
    private String originalUrl;
    private String originalObjectName;
    private String originalContentType;
    private long originalSizeBytes;
    private String previewUrl;
    private String previewObjectName;
    private String previewContentType;
    private long previewSizeBytes;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getAlbumId() {
        return albumId;
    }

    public void setAlbumId(Long albumId) {
        this.albumId = albumId;
    }

    public String getCaption() {
        return caption;
    }

    public void setCaption(String caption) {
        this.caption = caption;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public LocalDate getTakenAt() {
        return takenAt;
    }

    public void setTakenAt(LocalDate takenAt) {
        this.takenAt = takenAt;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }

    public int getWidth() {
        return width;
    }

    public void setWidth(int width) {
        this.width = width;
    }

    public int getHeight() {
        return height;
    }

    public void setHeight(int height) {
        this.height = height;
    }

    public String getOriginalUrl() {
        return originalUrl;
    }

    public void setOriginalUrl(String originalUrl) {
        this.originalUrl = originalUrl;
    }

    public String getOriginalObjectName() {
        return originalObjectName;
    }

    public void setOriginalObjectName(String originalObjectName) {
        this.originalObjectName = originalObjectName;
    }

    public String getOriginalContentType() {
        return originalContentType;
    }

    public void setOriginalContentType(String originalContentType) {
        this.originalContentType = originalContentType;
    }

    public long getOriginalSizeBytes() {
        return originalSizeBytes;
    }

    public void setOriginalSizeBytes(long originalSizeBytes) {
        this.originalSizeBytes = originalSizeBytes;
    }

    public String getPreviewUrl() {
        return previewUrl;
    }

    public void setPreviewUrl(String previewUrl) {
        this.previewUrl = previewUrl;
    }

    public String getPreviewObjectName() {
        return previewObjectName;
    }

    public void setPreviewObjectName(String previewObjectName) {
        this.previewObjectName = previewObjectName;
    }

    public String getPreviewContentType() {
        return previewContentType;
    }

    public void setPreviewContentType(String previewContentType) {
        this.previewContentType = previewContentType;
    }

    public long getPreviewSizeBytes() {
        return previewSizeBytes;
    }

    public void setPreviewSizeBytes(long previewSizeBytes) {
        this.previewSizeBytes = previewSizeBytes;
    }
}
