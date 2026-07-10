# 需要隐藏的应用包名
hide_apps=(
    "com.google.android.googlequicksearchbox" # Google
    "com.android.documentsui"                 # 文件
    "com.google.android.apps.messaging"       # 信息
    "com.android.vending"                     # Google Play 商店
    "org.lineageos.recorder"                  # 录音机
    "com.google.android.contacts"             # 通讯录
    "com.android.gallery3d"                   # 图库
    # "io.github.huskydg.magisk"              # Magisk Delta
    "org.lineageos.jelly"                     # 浏览器
    "org.lineageos.eleven"                    # 音乐
    "org.lineageos.etar"                      # 日历
    "org.lineageos.aperture"                  # 相机
    "com.android.settings"                    # 设置
    "com.android.calculator2"                 # 计算器
    "com.android.deskclock"                   # 时钟
    "com.google.android.apps.restore"         # Android Switch
)

for app in "${hide_apps[@]}"; do
    file="$HOME/.local/share/applications/waydroid.${app}.desktop"
    if [ -f "$file" ]; then
        # 恢复文件写权限
        chmod u+w "$file"

        # 清理旧属性
        sed -i '/NoDisplay=true/d' "$file"
        # 把 NoDisplay=true 添加在 [Desktop Entry] 的下一行
        sed -i '/^\[Desktop Entry\]/a NoDisplay=true' "$file"

        # 移除所有用户的写权限，防止 Waydroid 重启时覆盖
        chmod a-w "$file"
        echo "[+] 已成功隐藏并锁定: $app $app"
    else
        echo "[!] 未找到文件 (可能已被隐藏或未生成): $app"
    fi
done

# 刷新 KDE Plasma 的组件缓存
kbuildsycoca6 --noincremental
echo "[*] 缓存刷新完成，已将指定的图标从 KDE 菜单中移除"