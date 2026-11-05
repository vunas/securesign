import logging
import sys

# Tạo logger chính cho hệ thống
logger = logging.getLogger("digital_signature_app")
logger.setLevel(logging.INFO)

# Định dạng format chuẩn: Thời gian | Mức độ | File sinh log | Nội dung
formatter = logging.Formatter(
    fmt="%(asctime)s | %(levelname)-8s | %(module)s:%(lineno)d | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

# Xuất log ra màn hình Console (Stdout)
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

# Lưu thêm log vào file để audit (Kiểm toán) sau này
# file_handler = logging.FileHandler("app_audit.log", encoding="utf-8")
# file_handler.setFormatter(formatter)
# logger.addHandler(file_handler)
