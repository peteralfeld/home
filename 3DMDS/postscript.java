import java.awt.*;
import java.io.*;
import java.util.Date;
import java.awt.event.*;

class postscript extends Frame 
    implements ActionListener, ItemListener, Serializable {

    Color bg = new Color(50,255,120);

    TextField name;

    Button save;

    Button gray;

    Boolean Gray = false;

    Choice aspect;

    Panel Panel1, Panel2;

    public void init() {
	Panel1 = new Panel();
        save = new Button("save");
        save.setBackground(Color.red);
        save.setForeground(Color.white);
        save.addActionListener(this); 
	Panel1.add(save);
        gray = new Button("Color Mode");
	gray.setBackground(new Color(0,0,127));
	gray.setForeground(Color.white);
        gray.addActionListener(this); 
	Panel1.add(gray);
        Panel1.add(new Label("Size:"));
	aspect = new Choice();
	aspect.add("full letter");
	aspect.add("screen letter");
	aspect.add("screen");
	aspect.add("square letter");
	aspect.add("legal");
	aspect.add("11x17");
	aspect.add("17x22");
	aspect.add("A4");
	aspect.setBackground(Color.white);
	aspect.setForeground(Color.red);
        aspect.select(3);
	Panel1.add(aspect);
	name = new TextField(tv.TV.fileName.getText(),50);
        name.setBackground(Color.white);
        name.setForeground(Color.black);
	Panel2 = new Panel();
        Panel2.add(new Label("File Name"));
	Panel2.add(name);
	setLayout(new GridLayout(2,1));
	add(Panel1);
	add(Panel2);
        setTitle("Postscript Output");
	setSize(500,150);
        setBackground(bg);
	setVisible(true);
    }

    public void  itemStateChanged(java.awt.event.ItemEvent E) {
    }

    public void actionPerformed(java.awt.event.ActionEvent E) {
        Object arg = E.getSource();
	if (arg.equals(save)) {
	    tv.Config.ps();
	}
	else if (arg.equals(gray)) {
	    Gray = !Gray;
	    if (Gray) {
                gray.setBackground(new Color(150,150,150));
		setBackground(new Color(150,150,150));
	    }
	    else {
                gray.setBackground(new Color(0,0,127));
		setBackground(bg);
	    }
	}
    }

    void write (String s) {
	System.out.println(s);
    }

    void debug (String s) {
	System.out.println(s);
    }


}

