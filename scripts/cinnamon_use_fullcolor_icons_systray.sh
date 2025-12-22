#!/bin/bash

if [[ $EUID -ne 0 ]]; then
   echo "Error: This script must be run as root." 
   echo "Please use: sudo $0"
   exit 1
fi

sed -i 's/set_applet_icon_symbolic_name/set_applet_icon_name/g' "/usr/share/cinnamon/applets/sound@cinnamon.org/applet.js"

sed -i 's/Type\.SYMBOLIC/Type.FULLCOLOR/g' "/usr/share/cinnamon/applets/network@cinnamon.org/applet.js"
sed -i 's/set_applet_icon_symbolic_name/set_applet_icon_name/g' "/usr/share/cinnamon/applets/network@cinnamon.org/applet.js"

sed -i 's/Type\.SYMBOLIC/Type.FULLCOLOR/g' "/usr/share/cinnamon/applets/removable-drives@cinnamon.org/applet.js"
sed -i 's/set_applet_icon_symbolic_name/set_applet_icon_name/g' "/usr/share/cinnamon/applets/removable-drives@cinnamon.org/applet.js"

sed -i 's/set_applet_icon_symbolic_name/set_applet_icon_name/g' "/usr/share/cinnamon/applets/notifications@cinnamon.org/applet.js"
sed -i 's/Type\.SYMBOLIC/Type.FULLCOLOR/g' "/usr/share/cinnamon/applets/notifications@cinnamon.org/applet.js"

sed -i 's/set_applet_icon_symbolic_name/set_applet_icon_name/g' "/usr/share/cinnamon/applets/favorites@cinnamon.org/applet.js"
sed -i 's/Type\.SYMBOLIC/Type.FULLCOLOR/g' "/usr/share/cinnamon/applets/favorites@cinnamon.org/applet.js"

sed -i 's/Type\.SYMBOLIC/Type.FULLCOLOR/g' "/usr/share/cinnamon/js/ui/applet.js"
sed -i 's/Type\.SYMBOLIC/Type.FULLCOLOR/g' "/usr/share/cinnamon/js/ui/panel.js"

sed -i 's/Type\.SYMBOLIC/Type.FULLCOLOR/g' "/usr/share/cinnamon/applets/grouped-window-list@cinnamon.org/applet.js"

sed -i 's/Type\.SYMBOLIC/Type.FULLCOLOR/g' "/usr/share/cinnamon/applets/grouped-window-list@cinnamon.org/menus.js"

sed -i 's/Type\.SYMBOLIC/Type.FULLCOLOR/g' "/usr/share/cinnamon/applets/user@cinnamon.org/applet.js"
sed -i 's/set_applet_icon_symbolic_name/set_applet_icon_name/g' "/usr/share/cinnamon/applets/user@cinnamon.org/applet.js"
