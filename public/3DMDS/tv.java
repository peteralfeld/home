import java.awt.*;
import java.awt.event.*;
import java.io.*;
import java.text.*;

public class tv extends Frame 
    implements ActionListener, ItemListener, Serializable {

    static postscript Postscript;
    static tv TV;
    static ct CT;
    static ms MS;
    static dct dCT;
    static wf WF;
    static ps PS;
    static dctf DCTF;
    static msf MSF;
    static cellControl CC;
    static select Select;
    static refine REFINE;
    static special SPECIAL;
    static gen Gen;
    static annotate ANNOTATE; 
    static vNames VNAMES; 
    static prime PRIME;
    static appearance APPEARANCE;
    static star Star;
    static String banner;


    static boolean batch = false; 
    /* set batch true if used without control or drawing window */

    static boolean Cells = false;

    static boolean inApplet = true;

    boolean newPlot = false;
    boolean restored = false;

    Panel Panel0; 
    Label Banner; static TextField Status;
    static Button Bounds, clb, cub;
    static Button Shell, Assemble, Build;

    static Button generals;
    static Button macros;
    static Button cells;

    Panel Panel1; 
    static Button Prime;
    static Button Appearance;
    static Button Beep, Flush, Stop, Quit, Exit, dPlus, dMinus, rPlus, rMinus, Qidentity, initialize, restart, complete, reset, identical; 
    static TextField td, tr; 
    static Choice configuration;
    static Choice cMode;
    static Button stars;

    Panel Panel2;
    static Button Refine;
    static Choice globs;
    static Button grid, Vtcs, coords, numbers, dynamicCoords, dynamicDps;
    static Button Show, Hide;
    
    Panel Panel2a;
    static Button Annotate, ps, gmv, showFaces, print, save, restore, writeDps, readDps, VNames; 
    static TextField fileName;

    static boolean showGrid = true, labelVtcs = true, showCoords = false, showDynamicCoords = false, showDynamicDps = false, showNumbers = false;

    static Button Visible, Total;

    static TextField tDiameter; 
    static Button diameterPlus, diameterMinus;

    Panel Panel2b;
    static Button Special, undoSpecial, listSpecial, clearSpecial, Super, undoSuper, listSuper, clearSuper, Analyze, Forward, Stability, Code, listEqs, StartOver, 
	writeSuper, readSuper;

    Panel Panel3;
    Button Silence, Strong, Remove, unZoom, unDelete, select, hidden; 
    static boolean selectOn = false;
    static boolean refineOn = false;
    Button listDps, testA, Matrix, rMatrix;

    static config Config;
    
    static int d, r, diameter;

    Color doit = new Color(0,127,50);
    Color dont = new Color(127,0,0);

    Color buttonBackground = new Color(0,127,0);
    Color buttonForeground = Color.white;
    Color textBackground = Color.white;
    Color textForeground = Color.black;
    Color fg = new Color(0,0,127);
    Color bg = new Color(220,220,255);

    int rold = r;
    int dold = d;

    public tv() {
        init();
    }
   
    int initialChoice;

    public void init() {

        d = 5; r = 1; diameter = 18;
        initialChoice = 5;  /* CT = 5 */

	Panel0 = new Panel();
        Flush = new Button("Flush");
        Flush.setBackground(Color.red);
        Flush.setForeground(Color.white);
        Flush.addActionListener(this); 
	Panel0.add(Flush);
        Stop = new Button("Stop");
        Stop.setBackground(Color.red);
        Stop.setForeground(Color.white);
        Stop.addActionListener(this); 
	Panel0.add(Stop);
        Quit = new Button("Quit");
        Quit.setBackground(Color.red);
        Quit.setForeground(Color.white);
        Quit.addActionListener(this); 
	Panel0.add(Quit);
        Beep = new Button("Beep");
        Beep.setBackground(Color.yellow);
        Beep.setForeground(Color.red);
        Beep.addActionListener(this); 
	Panel0.add(Beep);
        Exit = new Button("Exit");
        Exit.setBackground(Color.yellow);
        Exit.setForeground(Color.red);
        Exit.addActionListener(this); 
	Panel0.add(Exit);
        banner = " 3dMDS: version 105, September 2011";
        write(banner);
        Banner = new Label(banner);
        Banner.setForeground(fg);
        Banner.setBackground(bg);
        Panel0.add(Banner);
	Status = new TextField(50);
        Status.setBackground(Color.white);
        Status.setForeground(new Color(0,0,155));
        Panel0.add(Status);
        Prime = new Button("Prime");
        Prime.setBackground(Color.red);
        Prime.setForeground(Color.white);
        Prime.addActionListener(this); 
	Panel0.add(Prime);
        Appearance = new Button("Transparency");
        Appearance.setBackground(Color.red);
        Appearance.setForeground(Color.white);
        Appearance.addActionListener(this); 
	Panel0.add(Appearance);

        Show = new Button("Front");
        Show.setBackground(new Color(30,30,30));
        Show.setForeground(Color.white);
        Show.addActionListener(this); 
	Panel0.add(Show);

        Hide = new Button("Back");
        Hide.setBackground(new Color(30,30,30));
        Hide.setForeground(Color.white);
        Hide.addActionListener(this); 
	Panel0.add(Hide);      

        Panel1 = new Panel();
        Label rLab = new Label("   r:");
        rLab.setForeground(fg);
        rLab.setBackground(bg);
        Panel1.add(rLab);
        rMinus = new Button("<");
        rMinus.setBackground(buttonBackground);
        rMinus.setForeground(buttonForeground);
        rMinus.addActionListener(this); 
	Panel1.add(rMinus);
        tr = new TextField(5);
        tr.setBackground(textBackground);        
        tr.setForeground(textForeground);        
        tr.setText(" "+r);
        tr.addActionListener(this); 
        Panel1.add(tr);
        rPlus = new Button(">");
        rPlus.setBackground(buttonBackground);
        rPlus.setForeground(buttonForeground);
        rPlus.addActionListener(this); 
	Panel1.add(rPlus);
        Label dLab = new Label("   d:");
        dLab.setForeground(fg);
        dLab.setBackground(bg);
        Panel1.add(dLab);
        dMinus = new Button("<");
        dMinus.setBackground(buttonBackground);
        dMinus.setForeground(buttonForeground);
        dMinus.addActionListener(this); 
	Panel1.add(dMinus);
        td = new TextField(5);
        td.setBackground(textBackground);        
        td.setForeground(textForeground);        
        td.setText(" "+d);
        td.addActionListener(this); 
        Panel1.add(td);
        dPlus = new Button(">");
        dPlus.setBackground(buttonBackground);
        dPlus.setForeground(buttonForeground);
        dPlus.addActionListener(this); 
	Panel1.add(dPlus);
        configuration = new Choice();
        configuration.add("import");
        configuration.add("1 tetrahedron");
        configuration.add("2 tetrahedra");
        configuration.add("3 orange");
        configuration.add("type-I-cube");
        configuration.add("Clough Tocher");
        configuration.add("Morgan-Scott");
        configuration.add("Octahedron");
        configuration.add("Worsey-Farin");
        configuration.add("double CT");
        configuration.add("type-IV-cube");
        configuration.add("generic Morgan-Scott");
        configuration.add("generic Octahedron");
        configuration.add("generic Worsey-Farin");
        configuration.add("generic double CT");
        configuration.add("generic type-IV");
        configuration.add("Rudin");
        configuration.add("MS face");
        configuration.add("Wang MS face");
        configuration.add("double CT face");
        configuration.add("8-cell");
        configuration.add("aligned Powell-Sabin");
        configuration.add("Powell-Sabin");
        configuration.add("generic Powell-Sabin");
        configuration.add("inverted");
        configuration.add("T60");
        configuration.add("T504");
        configuration.add("symmetric Worsey-Piper");
        configuration.add("generic Worsey-Piper");
        configuration.add("symmetric MS cone");
        configuration.add("generic MS cone");
        configuration.add("general assembly");
        configuration.setBackground(Color.white);
        configuration.setForeground(Color.red);
        configuration.addItemListener(this);
        configuration.select(initialChoice);
        Panel1.add(configuration);

        generals = new Button("general");
	generals.setBackground(new Color(127,0,30));
        generals.setForeground(Color.white);
        generals.addActionListener(this); 
	Panel1.add(generals);

        macros = new Button("macro elements");
	macros.setBackground(new Color(127,0,30));
        macros.setForeground(Color.white);
        macros.addActionListener(this); 
	Panel1.add(macros);

        cells = new Button("cells");
	cells.setBackground(new Color(127,0,30));
        cells.setForeground(Color.white);
        cells.addActionListener(this); 
	Panel1.add(cells);

        identical = new Button("identical");
        identical.setBackground(Color.red);
        identical.setForeground(Color.white);
        identical.addActionListener(this); 
	Panel1.add(identical);

        initialize = new Button("initialize");
        initialize.setBackground(doit);
        initialize.setForeground(buttonForeground);
        initialize.addActionListener(this); 
	Panel1.add(initialize);

        complete = new Button("complete");
        complete.setBackground(doit);
        complete.setForeground(buttonForeground);
        complete.addActionListener(this); 
	Panel1.add(complete);

        restart = new Button("restart");
        restart.setBackground(doit);
        restart.setForeground(buttonForeground);
        restart.addActionListener(this); 
	Panel1.add(restart);

        reset = new Button("reset");
        reset.setBackground(doit);
        reset.setForeground(buttonForeground);
        reset.addActionListener(this); 
	Panel1.add(reset);

        stars = new Button("stars");
        stars.setBackground(new Color(0,0,100));
        stars.setForeground(Color.yellow);
        stars.addActionListener(this); 
	Panel1.add(stars);

        Panel2 = new Panel();

	Annotate = new Button("Annotate");
	Annotate.setBackground(new Color(127,0,0));
	Annotate.setForeground(buttonForeground);
	Annotate.addActionListener(this); 
	Panel2.add(Annotate);

	Refine = new Button("refine");
	Refine.setBackground(doit);
	Refine.setForeground(buttonForeground);
	Refine.addActionListener(this); 
	Panel2.add(Refine);

        globs = new Choice();
        globs.add("point");
        globs.add("vertex");
        globs.add("edge");
        globs.add("face");
        globs.add("tetrahedron");
        globs.add("hull");
        globs.add("visible");
        globs.setBackground(Color.red);
        globs.setForeground(Color.blue);
        globs.addItemListener(this); 
        Panel2.add(globs);

        grid = new Button("grid");
        if (showGrid) {
	    grid.setBackground(dont);
	}
        else {
	    grid.setBackground(doit);
	}
        grid.setForeground(buttonForeground);
        grid.addActionListener(this); 
	Panel2.add(grid);
        Vtcs = new Button("Vtcs");
        if (labelVtcs) {
	    Vtcs.setBackground(dont);
	}
        else {
	    Vtcs.setBackground(doit);
	}
        Vtcs.setForeground(buttonForeground);
        Vtcs.addActionListener(this); 
	Panel2.add(Vtcs);

        coords = new Button("coords");
	if (showCoords) {
	    coords.setBackground(dont);
	}
	else {
	    coords.setBackground(doit);
	}
        coords.setForeground(buttonForeground);
        coords.addActionListener(this); 
	Panel2.add(coords);
	cMode = new Choice();
	cMode.add("long");
	cMode.add("short");
	cMode.add("numerical");
	cMode.add("TeX");
	cMode.setBackground(Color.red);
	cMode.setForeground(Color.blue);
	cMode.addItemListener(this); 
	Panel2.add(cMode);

	VNames = new Button("vtx names");
	VNames.setBackground(new Color(127,0,0));
	VNames.setForeground(buttonForeground);
	VNames.addActionListener(this); 
	Panel2.add(VNames);

        numbers = new Button("DP labels");
	if (showNumbers) {
	    numbers.setBackground(dont);
	}
	else {
	    numbers.setBackground(doit);
	}
        numbers.setForeground(buttonForeground);
        numbers.addActionListener(this); 
	Panel2.add(numbers);

        dynamicCoords = new Button("dynamic");
	if (showDynamicCoords) {
	    dynamicCoords.setBackground(dont);
	}
	else {
	    dynamicCoords.setBackground(doit);
	}
        dynamicCoords.setForeground(buttonForeground);
        dynamicCoords.addActionListener(this); 
	Panel2.add(dynamicCoords);

        dynamicDps = new Button("Dps");
	if (showDynamicDps) {
	    dynamicDps.setBackground(dont);
	}
	else {
	    dynamicDps.setBackground(doit);
	}
        dynamicDps.setForeground(buttonForeground);
        dynamicDps.addActionListener(this); 
	Panel2.add(dynamicDps);

        Qidentity = new Button("Identity");
        Qidentity.setBackground(doit);
        Qidentity.setForeground(buttonForeground);
        Qidentity.addActionListener(this); 
	Panel2.add(Qidentity);

        Visible = new Button("visible");
        Visible.setBackground(new Color(200,50,50));
        Visible.setForeground(Color.white);
        Visible.addActionListener(this); 
	Panel2.add(Visible);
        Total = new Button("total");
        Total.setBackground(new Color(200,50,50));
        Total.setForeground(Color.white);
        Total.addActionListener(this); 
	Panel2.add(Total);
        Label diameterLab = new Label("  diameter:");
        diameterLab.setForeground(fg);
        diameterLab.setBackground(bg);
        Panel2.add(diameterLab);
        diameterMinus = new Button("<");
        diameterMinus.setBackground(buttonBackground);
        diameterMinus.setForeground(buttonForeground);
        diameterMinus.addActionListener(this); 
	Panel2.add(diameterMinus);
        tDiameter = new TextField(5);
        tDiameter.setBackground(textBackground);        
        tDiameter.setForeground(textForeground);        
        tDiameter.setText(" "+diameter);
        tDiameter.addActionListener(this); 
        Panel2.add(tDiameter);
        diameterPlus = new Button(">");
        diameterPlus.setBackground(buttonBackground);
        diameterPlus.setForeground(buttonForeground);
        diameterPlus.addActionListener(this); 
	Panel2.add(diameterPlus);

        if (!inApplet) {
	    Panel2a = new Panel();
	    showFaces = new Button("gv Hide Faces");
	    showFaces.setBackground(new Color(0,0,127));
	    showFaces.setForeground(buttonForeground);
	    showFaces.addActionListener(this); 
	    Panel2a.add(showFaces);
	    gmv = new Button("gv");
	    gmv.setBackground(new Color(0,0,127));
	    gmv.setForeground(buttonForeground);
	    gmv.addActionListener(this); 
	    Panel2a.add(gmv);
	    ps = new Button("ps");
	    ps.setBackground(new Color(255,0,0));
	    ps.setForeground(buttonForeground);
	    ps.addActionListener(this); 
	    Panel2a.add(ps);
	    print = new Button("Print");
	    print.setBackground(new Color(0,0,127));
	    print.setForeground(buttonForeground);
	    print.addActionListener(this); 
	    Panel2a.add(print);
            fileName = new TextField(30);
            fileName.setBackground(textBackground);        
            fileName.setForeground(textForeground);        
	    fileName.setText("cfg");
	    fileName.addActionListener(this); 
	    Panel2a.add(fileName);
	    save = new Button("Save");
	    save.setBackground(new Color(0,0,127));
	    save.setForeground(buttonForeground);
	    save.addActionListener(this); 
	    Panel2a.add(save);
	    restore = new Button("Restore");
	    restore.setBackground(new Color(0,0,127));
	    restore.setForeground(buttonForeground);
	    restore.addActionListener(this); 
	    Panel2a.add(restore);
	    writeDps = new Button("Write Dps");
	    writeDps.setBackground(new Color(0,127,127));
	    writeDps.setForeground(buttonForeground);
	    writeDps.addActionListener(this); 
	    Panel2a.add(writeDps);
	    readDps = new Button("Read Dps");
	    readDps.setBackground(new Color(0,127,127));
	    readDps.setForeground(buttonForeground);
	    readDps.addActionListener(this); 
	    Panel2a.add(readDps);
	    Analyze = new Button("Analyze");
	    Analyze.setForeground(Color.white);
	    Analyze.setBackground(Color.red);
	    Analyze.addActionListener(this); 
	    Panel2a.add(Analyze);
	    Forward = new Button("Forward");
	    Forward.setForeground(Color.white);
	    Forward.setBackground(Color.red);
	    Forward.addActionListener(this); 
	    Panel2a.add(Forward);
	    Stability = new Button("Stability");
	    Stability.setForeground(Color.white);
	    Stability.setBackground(Color.red);
	    Stability.addActionListener(this); 
	    Panel2a.add(Stability);
	    Code = new Button("Code");
	    Code.setForeground(Color.white);
	    Code.setBackground(Color.red);
	    Code.addActionListener(this); 
	    Panel2a.add(Code);
	    listEqs = new Button("list Eqs");
	    listEqs.setBackground(Color.red);
	    listEqs.setForeground(Color.white);
	    listEqs.addActionListener(this); 
	    Panel2a.add(listEqs);
	}

        Panel2b = new Panel();
        Special = new Button("Special");
        Special.setBackground(Color.red);
        Special.setForeground(Color.white);
        Special.addActionListener(this); 
	Panel2b.add(Special);

        undoSpecial = new Button("undo Special");
        undoSpecial.setBackground(Color.blue);
        undoSpecial.setForeground(Color.white);
        undoSpecial.addActionListener(this); 
	Panel2b.add(undoSpecial);

        clearSpecial = new Button("clear Special");
        clearSpecial.setBackground(Color.blue);
        clearSpecial.setForeground(Color.white);
        clearSpecial.addActionListener(this); 
	Panel2b.add(clearSpecial);

        listSpecial = new Button("list Special");
        listSpecial.setBackground(Color.blue);
        listSpecial.setForeground(Color.white);
        listSpecial.addActionListener(this); 
	Panel2b.add(listSpecial);

        Super = new Button("Super");
        Super.setBackground(Color.red);
        Super.setForeground(Color.white);
        Super.addActionListener(this); 
	Panel2b.add(Super);

        undoSuper = new Button("undo Super");
        undoSuper.setBackground(Color.blue);
        undoSuper.setForeground(Color.white);
        undoSuper.addActionListener(this); 
	Panel2b.add(undoSuper);

        clearSuper = new Button("clear Super");
        clearSuper.setBackground(Color.blue);
        clearSuper.setForeground(Color.white);
        clearSuper.addActionListener(this); 
	Panel2b.add(clearSuper);

        listSuper = new Button("list Super");
        listSuper.setBackground(Color.blue);
        listSuper.setForeground(Color.white);
        listSuper.addActionListener(this); 
	Panel2b.add(listSuper);

        StartOver = new Button("Start Over");
	StartOver.setBackground(Color.red);
        StartOver.setForeground(Color.white);
        StartOver.addActionListener(this); 
	Panel2b.add(StartOver);

        writeSuper = new Button("write Super");
        writeSuper.setBackground(Color.blue);
        writeSuper.setForeground(Color.white);
        writeSuper.addActionListener(this); 
	Panel2b.add(writeSuper);

        readSuper = new Button("read Super");
        readSuper.setBackground(Color.blue);
        readSuper.setForeground(Color.white);
        readSuper.addActionListener(this); 
	Panel2b.add(readSuper);

        Panel3 = new Panel();

        Silence = new Button("Silence");
        Silence.setForeground(new Color(255,100,255));
        Silence.setBackground(Color.black);
        Silence.addActionListener(this); 
	Panel3.add(Silence);

        Remove = new Button("Remove");
        Remove.setBackground(doit);
        Remove.setForeground(buttonForeground);
        Remove.addActionListener(this); 
	Panel3.add(Remove);

        unZoom = new Button("size");
        unZoom.setBackground(new Color(0,0,80));
        unZoom.setForeground(Color.white);
        unZoom.addActionListener(this); 
	Panel3.add(unZoom);

        unDelete = new Button("undelete");
        unDelete.setBackground(doit);
        unDelete.setForeground(buttonForeground);
        unDelete.addActionListener(this); 
	Panel3.add(unDelete);

        select = new Button("selections");
        select.setBackground(Color.red);
        select.setForeground(Color.cyan);
        select.addActionListener(this); 
	Panel3.add(select);

        listDps = new Button("list Dps");
	listDps.setBackground(doit);
        listDps.setForeground(buttonForeground);
        listDps.addActionListener(this); 
	Panel3.add(listDps);

        testA = new Button("show A");
	testA.setBackground(doit);
        testA.setForeground(buttonForeground);
        testA.addActionListener(this); 
	Panel3.add(testA);

        Matrix = new Button("plot Matrix");
	Matrix.setBackground(doit);
        Matrix.setForeground(buttonForeground);
        Matrix.addActionListener(this); 
	Panel3.add(Matrix);

        rMatrix = new Button("plot reduced Matrix");
	rMatrix.setBackground(doit);
        rMatrix.setForeground(buttonForeground);
        rMatrix.addActionListener(this); 
	Panel3.add(rMatrix);

        hidden = new Button("hidden");
        hidden.setBackground(doit);
        hidden.setForeground(buttonForeground);
        hidden.addActionListener(this); 
	Panel3.add(hidden);

        Strong = new Button("Strong");
        Strong.setBackground(new Color(100,255,255));
        Strong.setForeground(Color.black);
        Strong.addActionListener(this); 
	Panel3.add(Strong);

        Bounds = new Button("Bounds");
        Bounds.setBackground(new Color(100,20,100));
        Bounds.setForeground(Color.white);
        Bounds.addActionListener(this); 
        Panel3.add(Bounds);

        clb = new Button("c.l.b.");
        clb.setBackground(new Color(100,20,100));
        clb.setForeground(Color.white);
        clb.addActionListener(this); 
        Panel3.add(clb);

        cub = new Button("c.u.b.");
        cub.setBackground(new Color(100,20,100));
        cub.setForeground(Color.white);
        cub.addActionListener(this); 
        Panel3.add(cub);

        Shell = new Button("shell");
        Shell.setBackground(new Color(200,255,0));
        Shell.setForeground(Color.red);
        Shell.addActionListener(this); 
        Panel3.add(Shell);

        Assemble = new Button("assemble");
        Assemble.setBackground(new Color(200,255,0));
        Assemble.setForeground(Color.red);
        Assemble.addActionListener(this); 
        Panel3.add(Assemble);

        Build = new Button("build");
        Build.setBackground(new Color(200,255,0));
        Build.setForeground(Color.red);
        Build.addActionListener(this); 
        Panel3.add(Build);

        if (!inApplet){
	    setLayout(new GridLayout(6,1));
	}
	else {
	    setLayout(new GridLayout(5,1));
	}
        add(Panel0);
        add(Panel1);
        add(Panel2);
        if (!inApplet) {
	    add(Panel2a);
	}
        add(Panel2b);
        add(Panel3);
        setBackground(new Color(255,255,210));
        setSize(1100,250);
        setTitle("3D MDS Control");
        Config = new config();
        Config.setTitle("3D MDS Drawing");
    }

    public static void main(String[] args) {
	inApplet = false;
	TV = new tv();
	TV.setVisible(true);
    }

    static void write(String s) {
        System.out.println(s);
    } 

    static void debug(String s) {
        System.out.println(s);
    } 

    static void dup() {
	d++;
	td.setText(" " + d);
        Config.zoomed = false;
	Config.init();
    }

    static void rup() {
	if (r < d) {
	    r++;
	    tr.setText(" " + r);
	    Config.zoomed = false;
	    Config.init();
	}
    }


    static void ddown() {
	if (d > 1) {
	    d--;
            td.setText(" " + d);
	    Config.zoomed = false;
	    Config.init();
	}
    }

    static void rdown() {
	if (r > 0) {
	    r--;
            tr.setText(" " + r);
	    Config.zoomed = false;
	    Config.init();
	}
    }

    public void actionPerformed(java.awt.event.ActionEvent E) {
        Object arg = E.getSource();
        if (arg.equals(Stop)) {
	    Config.stop();
	}
        else if (arg.equals(Flush)) {
            Config.flush();
	}
        else if (arg.equals(Quit)) {
            write(" quitting ... ");
	    stop();
	}
        else {
	    Config.addEvent(E,21);
	}
    }

    public void ActionPerformed(java.awt.event.ActionEvent E) {
        Object arg = E.getSource();
        newPlot = false;
        dold = Config.d;
        rold = Config.r;
        int configold = configuration.getSelectedIndex();
        boolean renderit = false;
        if (arg.equals(Exit)) {
            write(" exiting ... ");
	    stop();
	}
        else if (arg.equals(Prime)) {
	    if (PRIME != null) {
		PRIME = null;
	    }
	    PRIME = new prime();
	    PRIME.setVisible(true);
	}
        else if (arg.equals(Appearance)) {
	    if (APPEARANCE != null) {
		APPEARANCE = null;
	    }
	    APPEARANCE = new appearance();
	    APPEARANCE.setVisible(true);
	}
        else if (arg.equals(dMinus)) {
	    ddown();
	}
        else if (arg.equals(dPlus)) {
            dup();
	}
        else if (arg.equals(td)) {
            int dd = getInt(td, d, 1,2147483647);
	    if (dd != d) { 
		td.setText(" " + d);
                d = dd;
		td.setText(" " + d);
                Config.init();
	    }
	}
        else if (arg.equals(rMinus)) {
            rdown();
	}
        else if (arg.equals(rPlus)) {
	    rup();
	}
        else if (arg.equals(tr)) {
	    int rr = getInt(tr, r, 0, d);
	    if (rr != r) { 
                r = rr;
		tr.setText(" " + r);
                Config.init();
	    }
	}
        else if (arg.equals(Stop)) {
            Config.stop();
	}
        else if (arg.equals(Quit)) {
            stop();
	}
        else if (arg.equals(Bounds)) {
            Config.Bounds();
	}
        else if (arg.equals(cub)) {
            Config.cub();
	}
        else if (arg.equals(Shell)) {
            Config.shell(true);
	}
        else if (arg.equals(Assemble)) {
            Config.shell(false);
	}
        else if (arg.equals(Build)) {
            Config.buildIt();
	}
        else if (arg.equals(cub)) {
            Config.cub();
	}
        else if (arg.equals(clb)) {
            Config.clb();
	}
        else if (arg.equals(grid)) {
	    showGrid = !showGrid;
	    if (showGrid) {
		grid.setBackground(dont);
	    }
	    else {
		grid.setBackground(doit);
	    }
            renderit = true;
	}
        else if (arg.equals(Vtcs)) {
	    labelVtcs = !labelVtcs;
	    if (labelVtcs) {
		Vtcs.setBackground(dont);
	    }
	    else {
		Vtcs.setBackground(doit);
	    }
            renderit = true;
	}
        else if (arg.equals(coords)) {
	    showCoords = !showCoords;
            if (showCoords) {
		coords.setBackground(dont);
	    }
            else {
		coords.setBackground(doit);
	    }
            Config.eraseCoords();
	}
        else if (arg.equals(numbers)) {
	    showNumbers = !showNumbers;
            if (showNumbers) {
		numbers.setBackground(dont);
	    }
            else {
		numbers.setBackground(doit);
	    }
            Config.numbers = showNumbers;
            Config.drawIt();
	}
        else if (arg.equals(dynamicCoords)) {
	    showDynamicCoords = !showDynamicCoords;
            if (showDynamicCoords) {
		dynamicCoords.setBackground(dont);
	    }
            else {
		dynamicCoords.setBackground(doit);
	    }
            Config.eraseCoords();
	}
        else if (arg.equals(dynamicDps)) {
	    showDynamicDps = !showDynamicDps;
            if (showDynamicDps) {
		dynamicDps.setBackground(dont);
	    }
            else {
		dynamicDps.setBackground(doit);
	    }
            Config.eraseCoords();
	}
        else if (arg.equals(Qidentity)) {
            Config.Qidentity();
            newPlot = true;
	}
        else if (arg.equals(Show)) {
            Config.toFront();
	}
        else if (arg.equals(Hide)) {
            Config.toBack();
	}
        else if (arg.equals(Qidentity)) {
            Config.Qidentity();
            newPlot = true;
	}
        else if (arg.equals(initialize)) {
            Config.selectSuper = false;
            Config.selectSpecial = false;
            Super.setBackground(Color.red);
            Special.setBackground(Color.red);
            if (tv.SPECIAL != null) {
		tv.SPECIAL.setVisible(false);
                tv.SPECIAL = null;
	    }
            Config.LAinit();
            newPlot = true;
	}
        else if (arg.equals(complete)) {
            Config.complete();
            newPlot = true;
	}
        else if (arg.equals(restart)) {
            Config.restart();
	}
        else if (arg.equals(reset)) {
            Config.fishy = false;
            Config.init();
	}
        else if (arg.equals(stars)) {
            Star = new star();
            Star.setVisible(true);
	}
        else if (arg.equals(identical)) {
	    Config.identical = !Config.identical;
            if (Config.identical) {
                identical.setBackground(new Color(0,127,0));
	    }
            else {
                identical.setBackground(Color.red);
	    }
	}
        else if (arg.equals(Visible)) {
            Config.showVisible();
	}
        else if (arg.equals(Total)) {
            Config.showTotal();
	}
        else if (arg.equals(diameterMinus) && diameter > 0) {
	    diameter--;
            tDiameter.setText(" " + diameter);
	    renderit = true;
	}
        else if (arg.equals(diameterPlus)) {
	    diameter++;
            tDiameter.setText(" " + diameter);
	    renderit = true;
	}
        else if (arg.equals(tDiameter)) {
	    int newDiameter = getInt(tDiameter, diameter, 0, 1000);
	    if (newDiameter != diameter) { 
		renderit = true;
                diameter = newDiameter;
		tDiameter.setText(" " + diameter);
	    }
	}
        else if (arg.equals(Super)) {
            Config.selectSuper = !Config.selectSuper;
            Config.selectSpecial = false;
	    Special.setBackground(Color.red);
            if (tv.SPECIAL != null) {
		tv.SPECIAL.setVisible(false);
                tv.SPECIAL = null;
	    }
            if (Config.selectSuper) {
		Super.setBackground(Color.green);
                Config.initSuper();
	    }
	    else {
		Super.setBackground(Color.red);
                Config.selectSuper = false;
                Config.drawIt();
	    }
	}
        else if (arg.equals(undoSuper)) {
            if (Config.nSuper > 0) {
                Config.decSuper();
	    }
	}
        else if (arg.equals(listSuper)) {
	    Config.listSuper();
	}
        else if (arg.equals(clearSuper)) {
	    Config.clearSuper();
	}
        else if (arg.equals(Special)) {
            Config.selectSpecial = !Config.selectSpecial;
            if (Config.selectSpecial) {
		if (SPECIAL != null) {
                    SPECIAL = null;
		}
                SPECIAL = new special();
                SPECIAL.setVisible(true);
	    }
            Config.selectSuper = false;
	    Super.setBackground(Color.red);
            if (Config.selectSpecial) {
		Special.setBackground(Color.green);
                Config.initSpecial();
	    }
	    else {
		Special.setBackground(Color.red);
		if (tv.SPECIAL != null) {
		    tv.SPECIAL.setVisible(false);
		    tv.SPECIAL = null;
		}
                Config.selectSpecial = false;
                Config.drawIt();
	    }
	}
        else if (arg.equals(undoSpecial)) {
            if (Config.nSpecial > 0) {
                Config.decSpecial();
	    }
	}
        else if (arg.equals(listSpecial)) {
	    Config.listSpecial();
	}
        else if (arg.equals(clearSpecial)) {
	    Config.clearSpecial();
	}
        else if (arg.equals(generals)) {
	    if (tv.Gen  == null) {
		tv.Gen = new gen();
	    }
            tv.Gen.setVisible(!tv.Gen.isVisible());
            if (tv.Gen.isVisible()) {
                configuration.select(31);
	    }
	}
        else if (arg.equals(macros)) {
            if (Config.configuration == 5) {
		if (tv.CT == null) {
		    tv.CT = new ct();
		}
		tv.CT.setVisible(!tv.CT.isVisible());
	    }
            else if (Config.configuration == 6 || Config.configuration == 11) {
		if (tv.MS == null) {
		    tv.MS = new ms();
		}
		tv.MS.setVisible(!tv.MS.isVisible());
	    }
            else if (Config.configuration == 8 || Config.configuration == 13 || Config.configuration == 26) {
		if (tv.WF == null) {
		    tv.WF = new wf();
		}
		tv.WF.setVisible(!tv.WF.isVisible());
	    }
            else if (Config.configuration == 21 || Config.configuration == 22 || Config.configuration == 23) {
		if (tv.PS == null) {
		    tv.PS = new ps();
		}
		tv.PS.setVisible(!tv.PS.isVisible());
	    }
            else if (Config.configuration == 19) {
		if (tv.DCTF == null) {
		    tv.DCTF = new dctf();
		}
		tv.DCTF.setVisible(!tv.DCTF.isVisible());
	    }
            else if (Config.configuration == 17 || Config.configuration == 18  ) {
		if (tv.MSF == null) {
		    tv.MSF = new msf();
		}
		tv.MSF.setVisible(!tv.MSF.isVisible());
	    }
            else if (Config.configuration == 9 || Config.configuration == 14 || Config.configuration == 24) {
		if (tv.dCT == null) {
		    tv.dCT = new dct();
		}
		tv.dCT.setVisible(!tv.dCT.isVisible());
	    }
	}
        else if (arg.equals(cells)) {
            Cells = !Cells;
	    if (Cells) {
		configuration.select(0);
                CC = new cellControl();
	    }
	}
        else if (arg.equals(listEqs)) {
	    Config.listEqs = !Config.listEqs;
            if (Config.listEqs) {
                listEqs.setBackground(new Color(0,127,0));
	    }
            else {
                listEqs.setBackground(Color.red);
	    }
	}
        else if (arg.equals(StartOver)) {
	    Config.startOver();
	}
        else if (arg.equals(writeSuper)) {
	    Config.wSuper();
	}
        else if (arg.equals(readSuper)) {
	    Config.rSuper();
	}
        else if (arg.equals(Silence)) {
            Config.silence = !Config.silence;
            if (Config.silence) {
		Silence.setForeground(Color.black);
		Silence.setBackground(new Color(255,100,255));
	    }
	    else {
		Silence.setForeground(new Color(255,100,255));
		Silence.setBackground(Color.black);
	    }
	}
        else if (arg.equals(Strong)) {
            Config.Strong = !Config.Strong;
            if (Config.Strong) {
		Strong.setForeground(Color.black);
		Strong.setBackground(new Color(100,255,255));
	    }
	    else {
		Strong.setForeground(new Color(100,255,255));
		Strong.setBackground(Color.black);
                Config.nz = null;
	    }
	}
        else if (arg.equals(Analyze) || arg.equals(Forward) || arg.equals(Stability) || arg.equals(Code) ) {
            if (!Config.LApresent) {
		Config.analyze = !Config.analyze;
	    }
            else {
		if (Config.analyze) {
                    if (arg.equals(Analyze)) {
			Config.analyzeIt(true);
		    }
                    else if (arg.equals(Forward)) {
			Config.analyzeIt(false);
		    }
		    else if (arg.equals(Stability)) {
                        Config.stability();
		    }
		    else if (arg.equals(Code)) {
                        Config.Code();
		    }
		}
                else {
		    Config.innocent();
                    Config.analyze = true;
                    Config.startOver();
		}
	    }
            if (Config.analyze) {
		Analyze.setForeground(Color.red);
		Analyze.setBackground(Color.white);
		Forward.setForeground(Color.red);
		Forward.setBackground(Color.white);
		Stability.setForeground(Color.red);
		Stability.setBackground(Color.white);
		Code.setForeground(Color.red);
		Code.setBackground(Color.white);
	    }
	    else {
		Analyze.setForeground(Color.white);
		Analyze.setBackground(Color.red);
		Forward.setForeground(Color.white);
		Forward.setBackground(Color.red);
		Stability.setForeground(Color.white);
		Stability.setBackground(Color.red);
		Code.setForeground(Color.white);
		Code.setBackground(Color.red);
                Config.Anlz = null;
		Config.Astab = null;
	    }
	}
        else if (arg.equals(Remove)) {
            Config.Remove = !Config.Remove;
            if (Config.Remove) {
		Remove.setLabel("unzoom");
	    }
	    else {
		Remove.setLabel("remove");
	    }
	}
        else if (arg.equals(unZoom)) {
            Config.zoomed = false;
            Config.renderit();
	}
        else if (arg.equals(unDelete)) {
            Config.undo();
	}
        else if (arg.equals(select)) {
            selectOn = !selectOn;
            if (selectOn) {
                Select = new select();
                Select.setVisible(true);
	    }
            else {
                if (Select != null) {
		    Select.setVisible(false);
		}
	    }
	}
        else if (arg.equals(Refine)) {
            if (!tv.Config.general) {
		refineOn = !refineOn;
		if (refineOn) {
		    REFINE = new refine();
		    REFINE.setVisible(true);
		}
		else {
		    if (REFINE != null) {
			REFINE.setVisible(false);
		    }
		}
	    }
            else {
		tv.Config.mess ("cannot refine general partitions");
                if (refineOn) {
		    refineOn = false;
		    if (REFINE != null) {
			REFINE.setVisible(false);
		    }
		}
	    }
	}
        else if (arg.equals(listDps)) {
	    Config.listDps();
	}
        else if (arg.equals(testA)) {
	    Config.testA();
	}
        else if (arg.equals(Matrix)) {
	    matrix MAT = new matrix();
	}
        else if (arg.equals(rMatrix)) {
	    rmatrix rMAT = new rmatrix();
	}
        else if (arg.equals(Annotate)) {
            if (ANNOTATE == null) {
		ANNOTATE = new annotate();
                ANNOTATE.setVisible(true);
	    }
	    else {
		ANNOTATE.setVisible(false);
		ANNOTATE = null;
	    }
	}
        else if (arg.equals(VNames)) {
            if (VNAMES == null) {
		VNAMES = new vNames();
                VNAMES.setVisible(true);
	    }
	    else {
		VNAMES.setVisible(false);
		VNAMES = null;
	    }
	}
        else if (arg.equals(hidden)) {
	    Config.hidden = !Config.hidden;
	}
        else if (arg.equals(gmv)) {
	    Config.gv();
	}
        else if (arg.equals(ps)) {
	    if (Postscript == null) {
		Postscript = new postscript();
		Postscript.init();             
	    }
	    else {
		Postscript.setVisible(false);
		Postscript = null;
	    }
	}
        else if (arg.equals(showFaces)) {
	    Config.showFaces = !Config.showFaces;
            if (!Config.showFaces) {
                showFaces.setLabel("hide faces");
	    }
            else {
                showFaces.setLabel("show faces");
	    }
	}
        else if (arg.equals(print)) {
	    Config.printIt();
	}
        else if (arg.equals(save)) {
	    saveIt();
	}
        else if (arg.equals(restore)) {
	    restoreIt();
	}
        else if (arg.equals(writeDps)) {
	    Config.wDps();
	}
        else if (arg.equals(readDps)) {
	    Config.rDps();
	}
        else if (arg.equals(Beep)) {
            System.out.print("");
	}
	if (newPlot) {
            Config.zoomed = false;
	    Config.renderit();
	}
        if (renderit) {
            Config.renderit();
	}
	if (r > d) {
	    r = d;
	    tr.setText(" " + r);
	}
        if (d != dold) {
            if (Select != null) {
		Select.setVisible(false);
                Select = null;
                selectOn = false;
	    }
	}
        if (r != rold || d != dold) {
            Config.innocent();
            if (WF != null) {
		WF.vdone = false;
		WF.edone = false;
		WF.fdone = false;
	    }
            if (PS != null) {
		PS.vdone = false;
		PS.edone = false;
		PS.fdone = false;
	    }
            if (DCTF != null) {
		DCTF.vdone = false;
		DCTF.edone = false;
		DCTF.fdone = false;
	    }
            if (MSF != null) {
		MSF.vdone = false;
		MSF.edone = false;
		MSF.fdone = false;
	    }
	}
    }
    
    void saveIt() {
	String file = fileName.getText();
	saveIt(file);
    }


    void saveIt(String file) {
        try {
            write("saving " + file);
            Config.saveHeight = Config.getSize().height;
            Config.saveWidth = Config.getSize().width;

	    ObjectOutputStream out = new ObjectOutputStream(new FileOutputStream(file));
            Config.offscreenImage = null;
            Config.doing = null;
            Config.selected = configuration.getSelectedItem();
            Config.g = null;
            Config.oG = null;
	    out.writeObject(Config);
            out.close();
            Config.makeGraphics();
            Config.drawIt();
            file = file + ".tri";
	    PrintWriter tri = new PrintWriter(new FileOutputStream(file));
            tri.println(Config.V + " " + Config.N);
            for (int i = 0; i < Config.V; i++) {
		tri.println(Config.vtcs[i][0] + " "  + Config.vtcs[i][1] + " "  + Config.vtcs[i][2]);
	    }         
            for (int i = 0; i < Config.N; i++) {
                tri.println(Config.tets[i][0] + " " + Config.tets[i][1] + " " + Config.tets[i][2] + " " + Config.tets[i][3]);
	    }
            tri.close();
            Config.cmb();
	}
        catch(java.io.FileNotFoundException e) {
	    write(" file not found " + e);
	}
        catch(java.io.IOException e) {
	    write(" IOException " + e);
	}
    }
    

    void restoreIt() {
	String file = fileName.getText();
	restoreIt(file);
    }    

    void restoreIt(String file) {
        write("restoring from " + file);
        try {
	    ObjectInputStream in = new ObjectInputStream(new FileInputStream(file));
            Config.setVisible(false);
            boolean success = true;
	    Config = (config) in.readObject();
            Config.setVisible(true);
            Config.setSize(Config.saveWidth,Config.saveHeight);
            Config.makeGraphics();
            Config.drawIt();
            tr.setText(" "+ Config.r);
            td.setText(" "+ Config.d);
            r = Config.r; 
            rold = r;
            d = Config.d; 
            dold = d;
            configuration.select(Config.selected);
	    restored = true;
            if (Config.LApresent) {
		Config.report();
	    }
 	}
        catch(java.io.FileNotFoundException e) {
	    write(" file not found " + e);
	    e.printStackTrace();
	}
        catch(java.io.IOException e) {
	    write(" IOException " + e);
	    e.printStackTrace();
	}
        catch(java.lang.ClassNotFoundException e) {
	    write(" class not found " + e);
	    e.printStackTrace();
	}
        catch (Exception e) {
            write(" restoring: Exception " + e); 
	    e.printStackTrace();
	}
        write(" restore complete ");
    }

    public int getInt(TextField where, int dflt, int low, int high) {
	int result;
	try{ result = Integer.parseInt(where.getText().trim()); }
	catch (NumberFormatException e) { result = dflt; write("did not parse "+where.getText()); };
	if (result < low) result = low;
	if (result > high) result = high;
	where.setText(String.valueOf(result));
	return result;
    }

    public void itemStateChanged(java.awt.event.ItemEvent E) {
        Object arg = E.getSource();
        if (!restored) {
	    if (arg.equals(configuration)) {
                Config.general = false;
		if (configuration.getSelectedIndex()  == 0 && !Cells) {
		    Config.loaded = false;
		}
		Config.init();
	    }
	    else if (arg.equals(globs)) {
		Config.drawIt();
	    }
	}
        else {
	    restored = false;
	}
    }

    void stop() {
        if (tv.CT != null) {
	    tv.CT.setVisible(false);
	}
        if (tv.dCT != null) {
	    tv.dCT.setVisible(false);
	}
        if (tv.WF != null) {
	    tv.WF.setVisible(false);
	}
        if (tv.PS != null) {
	    tv.PS.setVisible(false);
	}
        if (tv.DCTF != null) {
	    tv.DCTF.setVisible(false);
	}
        if (tv.MSF != null) {
	    tv.MSF.setVisible(false);
	}
        if (tv.MS != null) {
	    tv.MS.setVisible(false);
	}
        if (tv.CC != null) {
	    tv.CC.setVisible(false);
	}
        if (tv.Gen != null) {
	    tv.Gen.setVisible(false);
	}
        if (tv.Select != null) {
	    tv.Select.setVisible(false);
	}
        if (tv.APPEARANCE != null) {
	    tv.APPEARANCE.setVisible(false);
	}
        if (tv.PRIME != null) {
	    tv.PRIME.setVisible(false);
	}
        if (tv.Refine != null) {
	    tv.Refine.setVisible(false);
	}
        if (tv.ANNOTATE != null) {
	    tv.ANNOTATE.setVisible(false);
	}
        if (tv.VNAMES != null) {
	    tv.VNAMES.setVisible(false);
	}
	Config.setVisible(false);
	setVisible(false);
        if (!inApplet) {
	    System.exit(0);
	}
    }

    public void run() {
    }

}
