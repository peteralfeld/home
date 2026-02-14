import java.awt.*;
import java.awt.event.*;
import java.applet.*;

public class tvApplet extends Applet
    implements MouseListener{
 
    boolean first = true;

    public void init() {
        addMouseListener(this);
    }

    public void paint(Graphics g) {
	int hsize = 500;
	int vsize = 55;
	String s = "click here to activate the trivariate MDS code";
	Font f = new Font("TimesRoman", Font.BOLD,18);
	FontMetrics fm = getFontMetrics(f);
	setBackground(new Color(240,240,255));
	g.setColor(new Color(10,40,10));
	g.drawRect(0,0,hsize-1,vsize-1); 
	int xstart = (hsize - fm.stringWidth(s))/2;
	int ystart = (vsize - fm.getHeight())/2+fm.getHeight();
	g.setFont(f);
	g.drawString(s, xstart,ystart-10);
	s = ("click again to exit");
	xstart = (hsize - fm.stringWidth(s))/2;
	ystart = (vsize - fm.getHeight())/2+fm.getHeight();
	g.setColor(new Color(255,40,10)); 
	g.drawString(s, xstart,ystart+10);
    }

    public void mouseReleased (MouseEvent evt) {
    }

    public void mousePressed (MouseEvent evt) {
    }

    public void mouseExited (MouseEvent evt) {
    }

    public void mouseEntered (MouseEvent evt) {
    }

    public void mouseDragged (MouseEvent evt) {
    }

    public void mouseClicked (MouseEvent evt) {
        if (tv.TV == null) {
           tv.TV = new tv();
	}
        if (!tv.TV.isVisible()) {
	    tv.TV.setVisible(true);
            tv.TV.Config.setVisible(true);
	}
        else {
            tv.TV.stop();
	}
    }
}
