# 需要隐藏的应用包名
hide_apps=(
  "com.google.android.googlequicksearchbox" # Google
  "com.android.documentsui"                 # 文件
  "com.google.android.apps.messaging"       # 信息
  "com.android.vending"                     # Google Play 商店
  "org.lineageos.recorder"                  # 录音机
# "com.netease.uuremote"                    # UU远程
  "com.google.android.contacts"             # 通讯录
  "com.android.gallery3d"                   # 图库
# "io.github.huskydg.magisk"                # Magisk Delta
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
    # 1. 恢复文件写权限
    chmod u+w "$file"
    
    # 2. 清理旧的错位属性
    sed -i '/NoDisplay=true/d' "$file"
    
    # 3. 把 NoDisplay=true 挂在 [Desktop Entry] 的下一行
    sed -i '/^\[Desktop Entry\]/a NoDisplay=true' "$file"
    
    # 4. 剥夺所有用户的写权限，防止 Waydroid 重启时覆盖
    chmod a-w "$file"
    echo "✅ 已成功隐藏并锁定: $app $app"
  else
    echo "⚠️ 未找到文件 (可能已被隐藏或未生成): $app"
  fi
done

# 5.刷新 KDE Plasma 的组件缓存
kbuildsycoca6 --noincremental
echo "🎉 缓存刷新完成，指定的图标已从 KDE 菜单中彻底移除。"
