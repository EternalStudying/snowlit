package xyz.snowlit.draft;

import java.time.LocalDateTime;

/** Database row; serialized images and their object names stay inside the server. */
public class Draft {
    private Long id;
    private Long userId;
    private String kind;
    private String fieldsJson;
    private String imagesJson;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long value) { id = value; }
    public Long getUserId() { return userId; }
    public void setUserId(Long value) { userId = value; }
    public String getKind() { return kind; }
    public void setKind(String value) { kind = value; }
    public String getFieldsJson() { return fieldsJson; }
    public void setFieldsJson(String value) { fieldsJson = value; }
    public String getImagesJson() { return imagesJson; }
    public void setImagesJson(String value) { imagesJson = value; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime value) { createdAt = value; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime value) { updatedAt = value; }
}
