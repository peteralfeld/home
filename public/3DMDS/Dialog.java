import java.awt.*;
import java.awt.event.*;
import java.io.*;
import java.text.*;

public class Dialog extends Frame 
    implements ActionListener, ItemListener, Serializable {

    Label banner;
    Choice which; TextField name; Button Load, Get;
    Button Hide;
    Panel Panel0, Panel1;
    public Dialog() {

        Panel0 = new Panel();
        banner = new Label("Load Configuration");
	Color fg = new Color(0,0,127);
	Color bg = Color.white;
        banner.setForeground(fg);
        banner.setBackground(bg);
        Panel0.add(banner);
        Hide = new Button("Hide");
        Hide.setBackground(new Color(50,20,100));
        Hide.setForeground(Color.white);
        Hide.addActionListener(this); 
        Panel0.add(Hide);

        Panel1 = new Panel();
        which = new Choice();
        which.setForeground(Color.black);
        which.setBackground(new Color(210,255,255));
        which.add("file");
        which.add("www");
        which.add("general file");
        which.add("general www");
        which.select(0);
        Panel1.add(which);
 
        name = new TextField(30);
        String s = "";
        try {
	    s = tv.fileName.getText()+".dat";
	}
        catch (Exception e) {;}
        name.setText(s);        
        name.setBackground(Color.white);
        name.setForeground(Color.black);
        Panel1.add(name);

        Load = new Button("LOAD");
        Load.setBackground(Color.white);
        Load.setForeground(Color.red);
        Load.addActionListener(this); 
	Panel1.add(Load);

        Get = new Button("GET");
        Get.setBackground(Color.white);
        Get.setForeground(Color.red);
        Get.addActionListener(this); 
	Panel1.add(Get);

	setLayout(new GridLayout(2,1));
        add(Panel0);
        add(Panel1);

        setSize(500,150);
        setTitle("Load Configuration");        
        setBackground(new Color(255,255,210));
        setForeground(Color.black);
        setVisible(true);
    }

    public void itemStateChanged(java.awt.event.ItemEvent E) {
    }

    public void actionPerformed(java.awt.event.ActionEvent E) {
        Object arg = E.getSource();
        if (arg.equals(Load) || arg.equals(Get)) {
	    String s = name.getText().trim();
            int n = which.getSelectedIndex();
            tv.Config.load(n,s);
            if (arg.equals(Load)) {
		tv.Config.checkGeometry();
	    }
            setVisible(false);
	}
        else if (arg.equals(Hide)) {
	    setVisible(false);
	}
    }

}
