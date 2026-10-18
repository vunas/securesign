MAX_FILE_SIZE = 20 * 1024 * 1024


def validate_pdf_payload(content: bytes) -> None:
    """Kiểm tra tính hợp lệ của dữ liệu PDF trên RAM theo đặc tả SRS."""
    if not content:
        raise ValueError("Tệp tải lên không được rỗng.")

    if len(content) > MAX_FILE_SIZE:
        raise ValueError("Dung lượng tệp vượt quá giới hạn cho phép (tối đa 20MB).")

    # Kiểm tra Magic Bytes chuẩn PDF: 4 byte đầu tiên bắt buộc phải là %PDF
    if not content.startswith(b"%PDF-"):
        raise ValueError("Tệp tải lên không đúng định dạng PDF hợp lệ.")
