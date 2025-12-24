const Applet = imports.ui.applet;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Mainloop = imports.mainloop;

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        
        // this.set_applet_icon_name("office-calendar");
        this.set_applet_label("21:00 PM\n2025-12-22");

        // Create the Flyout Menu
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this.metadata = metadata;
        this.menu.actor.add_style_class_name('calendar-strata-popup');

        this._buildLayout();
    },

    generateCalendarMatrix(year, month) {
        month--;
        let matrix = [];
        let firstDayOfMonth = new Date(year, month, 1);
        let dayOfWeek = firstDayOfMonth.getDay(); 
        let diff = (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
        
        let currentDate = new Date(firstDayOfMonth);
        currentDate.setDate(firstDayOfMonth.getDate() - diff);

        for (let r = 0; r < 6; r++) {
            let row = [];
            for (let c = 0; c < 7; c++) {
                let y = currentDate.getFullYear();
                let m = (currentDate.getMonth() + 1).toString().padStart(2, '0');
                
                row.push({
                    day_number: currentDate.getDate(),
                    month_string: `${y}-${m}`
                });
                currentDate.setDate(currentDate.getDate() + 1);
            }
            matrix.push(row);
        }
        return matrix;
    },

    updateCalendarWidget() {
        this.updateCalendarPicture();
        this.updateCalendarGrid();
    },

    updateCalendarPicture() {
        let month = (new Date().getMonth() + 1).toString().padStart(2, '0');
        // month="01" //debug
        let dirPath = GLib.get_home_dir() + `/.local/share/cinnamon/applets/${this.metadata.uuid}/assets/monthly-images/${month}`;
        let cmd = `bash -c "find /home/janko/.local/share/cinnamon/applets/calendar-strata@jnk181/assets/{monthly-images,monthly-images-more}/${month} -type f | shuf -n 1"`;
        let [success, stdout, stderr] = GLib.spawn_command_line_sync(cmd);
        if (success) {
            let randomFileName = stdout.toString().trim();
            if (randomFileName) {
                let finalPath = randomFileName;
                this.calendarImage.set_style(`background-image: url('${finalPath}');`);
                global.log("Izabrana slika: " + randomFileName);
            }
        }
    },

    updateCalendarGrid() {
        let calendar_arr=this.generateCalendarMatrix((new Date()).getFullYear(),(new Date()).getMonth()+1)
        let current_month_str=`${(new Date()).getFullYear()}-${((new Date()).getMonth()+1).toString().padStart(2, '0')}`
        //this.calendarMatrix[5][5].get_child().set_text("15");
        for (let i = 0; i < 6; i++) {
            for (let j = 0; j < 7; j++) {
                this.calendarMatrix[i][j].remove_style_class_name("calendar-grid-row-day-current-month")
                this.calendarMatrix[i][j].remove_style_class_name("calendar-grid-row-day-other-month")
                this.calendarMatrix[i][j].remove_style_class_name("calendar-grid-row-day-current-day")

                this.calendarMatrix[i][j].get_child().set_text(calendar_arr[i][j].day_number.toString());
                if(calendar_arr[i][j].month_string==current_month_str) {
                    this.calendarMatrix[i][j].add_style_class_name('calendar-grid-row-day-current-month');
                    if((new Date()).getDate() == calendar_arr[i][j].day_number) {
                        this.calendarMatrix[i][j].add_style_class_name('calendar-grid-row-day-current-day');
                    }
                } else {
                    this.calendarMatrix[i][j].add_style_class_name('calendar-grid-row-day-other-month');
                }
            }
        }
    },

    updateDigitalClockWidget(now) {
        let ampm = now.getHours() >= 12 ? 'PM' : 'AM';
        
        this.digital_clock.set_text(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} ${ampm}`);
    },

    updateAppletText(now) {
        let ampm = now.getHours() >= 12 ? 'PM' : 'AM';

        let hours=now.getHours().toString().padStart(2, '0');
        let minutes=now.getMinutes().toString().padStart(2, '0');
        let seconds=now.getSeconds().toString().padStart(2, '0');

        let month=(now.getMonth()+1).toString().padStart(2, '0');
        let day=now.getDate().toString().padStart(2, '0');
        let year=now.getFullYear();
        this.set_applet_label(`${hours}:${minutes} ${ampm}\n${year}-${month}-${day}`);
    },

    _updateLoop() {
        if (this._timerId) {
            Mainloop.source_remove(this._timerId);
            this._timerId = null;
        }

        let now=new Date();
        this.updateAnalogClockWidget(now);
        this.updateDigitalClockWidget(now);
        this.updateAppletText(now);
        this._timerId = Mainloop.timeout_add_seconds(1, () => this._updateLoop());

        return false;
    },

    updateAnalogClockWidget(now) {
    
        // Calculate angles
        let hours = now.getHours() % 12;
        let mins = now.getMinutes();
        let secs = now.getSeconds();

        let hourAngle = (hours * 30) + (mins * 0.5);
        let minAngle = mins * 6;
        let secAngle = secs * 6;

        // Apply rotation
        // Clutter.RotateAxis.Z_AXIS is the 2D rotation axis
        this.analog_clock_hourhand.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, hourAngle);
        this.analog_clock_minhand.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, minAngle);
        this.analog_clock_sechand.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, secAngle);
    },

    _buildLayout: function() {
        // 1. The Main Outer Container (Horizontal)
        // This holds the Left Column (Calendar) and Right Column (Clock/Events)
        this.mainBox = new St.BoxLayout({ 
            vertical: false, 
            style_class: 'calendar-main-box',
            width:460,
            height:325
        });

        // --- LEFT COLUMN: CALENDAR ---
        let leftColumn = new St.BoxLayout({ 
            vertical: true, 
            style_class: 'calendar-column-left',
            width: 250
        });

        let calendarWidget = new St.BoxLayout({ 
            vertical: true, 
            style_class: 'widget-calendar-main',
            height:325
        });

        this.calendarImage = new St.BoxLayout({ 
            style_class: 'widget-calendar-image',
            height:120
        });

        calendarWidget.add_actor(this.calendarImage);

        // --- Month Navigation Row ---
        this.monthNav = new St.BoxLayout({ 
            vertical: false, 
            style_class: 'month-nav-box',
            style:""
        });

        // Use system symbolic icons for the arrows
        let prevIcon = new St.Icon({ 
            icon_name: 'go-previous', 
            style_class: 'nav-icon',
            icon_size:20, icon_type: St.IconType.FULLCOLOR
        });
        let nextIcon = new St.Icon({ 
            icon_name: 'go-next', 
            style_class: 'nav-icon',
            icon_size:20, icon_type: St.IconType.FULLCOLOR
        });

        let prevBtn = new St.Button({ child: prevIcon, style_class: 'nav-button' });
        let nextBtn = new St.Button({ child: nextIcon, style_class: 'nav-button' });

        this.monthLabel = new St.Label({ 
            text: "December 2025", 
            style_class: 'month-label',
        });

        // Add to the box: Button | Label (expanded) | Button
        this.monthNav.add(prevBtn);
        this.monthNav.add(this.monthLabel, { expand: true, x_align: St.Align.CENTER, y_align: St.Align.CENTER, y_fill: true });
        this.monthNav.add(nextBtn);
        calendarWidget.add_actor(this.monthNav)
        
        this.separator = new St.Bin({ 
            style_class: 'calendar-separator' 
        });

        calendarWidget.add_actor(this.separator)

        this.dateGrid = new St.BoxLayout({ 
            style_class: 'calendar-grid'
        });

        let daysOfWeek = ["M", "T", "W", "T", "F", "S", "S"];

        this.header_row=new St.BoxLayout({ 
            style_class: 'calendar-grid-row-header',
            height:20
        });

        // 1. Create the Day Headers
        for (let i = 0; i < 7; i++) {
            let dayLabel =new St.Bin({child: new St.Label({ 
                text: daysOfWeek[i], 
                style_class: 'calendar-grid-row-day-header' 
            }), width:30 });
            this.header_row.add(dayLabel, i, 0); // (column, row)
            
        }

        calendarWidget.add_actor(this.header_row,{x_fill: true, x_align: St.Align.STRETCH});

        this.calendarMatrix = [];

        // 2. Create the Placeholder Grid (6 rows of 7 days)
        for (let row = 1; row <= 6; row++) {
            let arr_row = [];
            let grid_row=new St.BoxLayout({ 
                style_class: 'calendar-grid-row',
                height:20
            });
            for (let col = 0; col < 7; col++) {
                let placeholder = new St.Bin({child: new St.Label({ 
                text: "0", 
                style_class: 'calendar-grid-row-day' 
            }), width:30});
                
                grid_row.add(placeholder, col, row);
                arr_row.push(placeholder);
                calendarWidget.add_actor(grid_row, {x_fill: true, x_align: St.Align.STRETCH});
            }
            this.calendarMatrix.push(arr_row);
        }

        calendarWidget.add_actor(this.dateGrid)

        leftColumn.add_actor(calendarWidget, {y_fill: true})

        // --- RIGHT COLUMN: CLOCK & EVENTS ---
        let rightColumn = new St.BoxLayout({ 
            vertical: true, 
            style_class: 'calendar-column-right',
            width: 210
        });

        this.analog_clock = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            style_class: "analog-clock-widget",
            width:145,
            height:145,
            x_expand:false,
            y_expand:false,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });

        this.analog_clock_face = new St.BoxLayout({
            style_class: "analog-clock-face",
            style:"",
            x_expand: true,
            y_expand: true,
            clip_to_allocation: true
        });

        this.analog_clock_hourhand = new St.BoxLayout({
            style_class: "analog-clock-hourhand",
            x_expand: true,
            y_expand: true
        });

        this.analog_clock_minhand = new St.BoxLayout({
            style_class: "analog-clock-minhand",
            x_expand: true,
            y_expand: true
        });

        this.analog_clock_sechand = new St.BoxLayout({
            style_class: "analog-clock-sechand",
            x_expand: true,
            y_expand: true
        });

        this.analog_clock_hourhand.set_pivot_point(0.5, 0.5);
        this.analog_clock_minhand.set_pivot_point(0.5, 0.5);
        this.analog_clock_sechand.set_pivot_point(0.5, 0.5);

        this.analog_clock.add_actor(this.analog_clock_face);
        this.analog_clock.add_actor(this.analog_clock_hourhand);
        this.analog_clock.add_actor(this.analog_clock_minhand);
        this.analog_clock.add_actor(this.analog_clock_sechand);
        rightColumn.add_actor(this.analog_clock);

        this.digital_clock = new St.Label({
            style_class: "digital-clock-widget",
            text: "00:00:00",
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });

        rightColumn.add_actor(this.digital_clock);

        this.events_box = new St.BoxLayout({
            style_class: "events-box-widget",
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL
        });
        rightColumn.add_actor(this.events_box);

        this._updateLoop();

        // Final Assembly
        this.mainBox.add_actor(leftColumn, {expand: true, 
        x_fill: true, 
        y_fill: true});
            this.mainBox.add_actor(rightColumn, {expand: true, 
        x_fill: true, 
        y_fill: true});

        // Add the mainBox to the actual Applet Menu
        this.menu.addActor(this.mainBox);

        this.updateCalendarWidget();
    },

    on_applet_clicked: function() {
        this.menu.toggle();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}