import java.awt.*;
import java.awt.event.*;
import java.io.*;
import java.text.*;


public class rmatrix extends Frame {

    int pixel = 1;
    int m = 0;
    int n = 0;
    int size = 0;
    int border = 50;
    boolean[][] nz;
    int height = 0;
    int width = 0;

    rmatrix() {
        if (tv.Config.LApresent) {
	    init();
	    repaint();
	}
	else {
            System.out.println(" initialize Linear Algebra ");
	}
    }

    void debug(String s) {
        System.out.println(s);
    }

    void init() {
        if (tv.Config.LApresent) {
	    m = tv.Config.rank;
	    n = tv.Config.active;
	    size = m;
	    if (n > m) {
		size = n;
	    }
	    nz = new boolean[m][n];
	    for (int i = 0; i < m; i++) {
		for (int j = 0; j < n; j++) {
		    nz[i][j] = (tv.Config.AM[i][j] != 0);
		}
	    }
	    height = m;
	    width = n;
	    if (size < 500) {
		pixel = 900/size;
		if (pixel > 20) {
		    pixel = 20;
		}
		height = height*pixel;
		width = width*pixel;
	    }
	    if (size > 900) {
		pixel = -size/500;
		height = -height/pixel;
		width = -width/pixel;
	    }
	    height = height + 2*border;
	    width = width + 2*border;
	    setSize(width,height);
	    setVisible(true);
	}
    }

    public void paint(Graphics g) {
        g.setColor(Color.black);
        g.fillRect(0,0,width,height);
        if (pixel > 4) {
            g.setColor(new Color(100,100,255));
            for (int i = 0; i <= m ; i++) {
		int y = i*pixel +border-1;
                g.drawLine(border,y,width-border,y);
	    }
            for (int j = 0; j <= n ; j++) {
		int x = j*pixel+border-1;
                g.drawLine(x,border,x,height-border);
	    }
	}
        if (pixel > 0) {
	    g.setColor(Color.green);
	}
        else {
	    g.setColor(Color.red);
	}
        for (int i = 0; i < m; i++) {
	    for (int j = 0; j < n; j++) {
		if (nz[i][j]) {
                    int x = 0;
                    int y = 0;
                    if (pixel > 0) {
			x = j*pixel;
                        y = i*pixel;
                    }
                    if (pixel < 0) {
                        x = -j/pixel;
                        y = -i/pixel;
		    }
                    x = x + border;
                    y = y + border;
                    if (pixel > 0) {
                        if (pixel > 2) {
			    g.fillRect(x,y,pixel-1,pixel-1);
                        }
                        else {
			    g.fillRect(x,y,pixel,pixel);
			}
		    }
                    else {
                        g.fillRect(x,y,1,1);
		    }                     
		}
	    }
	}
        String s = " reduced matrix is " + m + "x" + n;
        g.setColor(Color.white);
        g.drawString(s,border,height-border/2);
    }
}
 
          
        
