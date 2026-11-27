"""يضبط توقيع إصدار أندرويد ورقمه بعد توليد المشروع في CI.

يعمل على ملف android/app/build.gradle المولّد حديثاً بواسطة cap add android.
يفشل بصوت عالٍ إن لم يجد النصوص المتوقعة، كي لا يخرج APK غير موقّع بصمت.
"""
import os
import re
import sys

PATH = os.path.join("android", "app", "build.gradle")
src = open(PATH, encoding="utf-8").read()

# 1) تربط حزمة الإصدار بمفتاح التوقيع
src, n_release = re.subn(
    r"(release \{\n)",
    r"\1            signingConfig signingConfigs.release\n",
    src,
    count=1,
)

# 2) تعريف مفتاح التوقيع من متغيرات البيئة
signing_block = """    signingConfigs {
        release {
            storeFile file(System.getenv("KEYSTORE_FILE"))
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias System.getenv("KEYSTORE_ALIAS")
            keyPassword System.getenv("KEYSTORE_PASSWORD")
            storeType System.getenv("KEYSTORE_TYPE") ?: "PKCS12"
        }
    }

"""
src, n_block = re.subn(r"(    buildTypes \{)", signing_block + r"\1", src, count=1)

# 3) رقم الإصدار يتزايد مع كل تشغيل
version_code = os.environ["VERSION_CODE"]
version_name = os.environ["VERSION_NAME"]

# تحقق من سلامة المدخلات قبل حقنها في build.gradle
if not version_code.isdigit():
    sys.exit("VERSION_CODE must be numeric, got: " + repr(version_code))
if not version_name or any(c not in "0123456789." for c in version_name):
    sys.exit("VERSION_NAME must contain digits and dots only, got: " + repr(version_name))
src, n_code = re.subn(r"versionCode \d+", "versionCode " + version_code, src, count=1)
src, n_name = re.subn(r'versionName "[^"]*"', 'versionName "' + version_name + '"', src, count=1)

if not all([n_release, n_block, n_code, n_name]):
    sys.exit("قالب build.gradle المولّد تغيّر؛ حدّث apk/sign-android.py ليطابقه")

open(PATH, "w", encoding="utf-8").write(src)
print("ضُبط التوقيع والإصدار:", version_code, version_name)
