import java.awt.*;

public class mss {

  public static void main (String args[]) {
    Mss myMss = new Mss();
    myMss.setBackground(Color.white);
    myMss.resize(300,300);
    myMss.show();
  }
}

class Mss extends Frame {

  int[][] v;
  Color gb = Color.white;

  public void paint(Graphics g) {
    int hsize = size().width;
    int vsize = size().height;
    g.setColor(gb);
    g.fillRect(0,0,hsize,vsize);
    g.setColor(Color.black);
    int hoffset = 30;
    int voffset = 40;    
    v = new int[2][7];
    v[0][1] = hsize/2;
    v[1][1] = voffset;
    v[0][2] = hoffset;
    v[1][2] = vsize-voffset;
    v[0][3] = hsize-hoffset;
    v[1][3] = vsize-voffset;
    for (int i = 0; i < 2; i++) {
      v[i][4]  = (v[i][1] + 2*v[i][2] + 2*v[i][3])/5;
      v[i][5]  = (2*v[i][1] + v[i][2] + 2*v[i][3])/5;
      v[i][6]  = (2*v[i][1] + 2*v[i][2] + v[i][3])/5;
    }
    for (int i = 0; i < 2; i++) {
      v[i][4]  = (v[i][1] + 2*v[i][2] + 2*v[i][3])/5;
      v[i][5]  = (2*v[i][1] + v[i][2] + 2*v[i][3])/5;
      v[i][6]  = (2*v[i][1] + 2*v[i][2] + v[i][3])/5;
    }
    g.setColor(Color.black);
    dl(g,1,2,1);
    dl(g,2,3,1);
    dl(g,3,1,1);
    dl(g,1,6,1);
    dl(g,6,2,1);
    dl(g,2,4,1);
    dl(g,4,3,1);
    dl(g,3,5,1);
    dl(g,5,1,1);
    dl(g,4,5,1);
    dl(g,5,6,1);
    dl(g,6,4,1);
    g.setColor(Color.green);
    dl(g,1,4,1);
    dl(g,2,5,1);
    dl(g,3,6,1);
    int radius = 30;
    int thick = 5;
    g.setColor(Color.black);
    Font fq = new Font("TimesRoman", Font.BOLD, 10);
    g.setFont(fq);
     FontMetrics fmq = getFontMetrics(fq);
    String s = "Symmetry of the Morgan Scott Split";
   int xstart = (hsize - fmq.stringWidth(s))/2;
   g.drawString(s, xstart, vsize-20); 

  }

  public void quadri(Graphics g, int i1, int i2, int i3, int i4, int position, int degree, Color col, int thick, int start) {
    v[0][start] = (v[0][i1] + (position-1)*v[0][i2] + (degree-position)*v[0][i3])/degree;
    v[1][start] = (v[1][i1] + (position-1)*v[1][i2] + (degree-position)*v[1][i3])/degree;
    v[0][start+1] = (position*v[0][i2] + (degree-position)*v[0][i3])/degree;
    v[1][start+1] = (position*v[1][i2] + (degree-position)*v[1][i3])/degree;
    g.setColor(col);
    dl(g,start,start+1,thick);
    v[0][start] = (v[0][i4] + (position-1)*v[0][i2] + (degree-position)*v[0][i3])/degree;
    v[1][start] = (v[1][i4] + (position-1)*v[1][i2] + (degree-position)*v[1][i3])/degree;
    dl(g,start,start+1,thick);
    v[0][start+1] = ((position-1)*v[0][i2] + (degree-position+1)*v[0][i3])/degree;
    v[1][start+1] = ((position-1)*v[1][i2] + (degree-position+1)*v[1][i3])/degree;
    dl(g,start,start+1,thick);
    v[0][start] = (v[0][i1] + (position-1)*v[0][i2] + (degree-position)*v[0][i3])/degree;
    v[1][start] = (v[1][i1] + (position-1)*v[1][i2] + (degree-position)*v[1][i3])/degree;
    dl(g,start,start+1,thick);
  }

  public void ddot(Graphics g, int i1, int i2, int i3, int i, int j, int k, Color rim, Color interior, int radius, int thick){
    int x = (i*v[0][i1] + j*v[0][i2] + k*v[0][i3])/(i+j+k);
    int y = (i*v[1][i1] + j*v[1][i2] + k*v[1][i3])/(i+j+k);
    dot(g, x, y, rim, interior, radius, thick);
  }

  public void write(String s) {
    System.out.println(s);
  }
 
  public void bnet(Graphics g,int i1, int i2, int i3, int degree, Color rim, Color interior, int radius, int thick) {
    for (int i = 0; i <=degree; i++) {
      for (int j = 0; j <=degree-i; j++) {
	int k = degree-i-j;
	int x =  (i*v[0][i1]+j*v[0][i2]+k*v[0][i3])/degree;
	int y =  (i*v[1][i1]+j*v[1][i2]+k*v[1][i3])/degree;
	dot(g,x,y,rim,interior,radius,thick);
      }
    }
  }

  public void dot(Graphics g, int x, int y, Color rim, Color interior, int radius, int thick) {
    g.setColor(interior);
    g.fillOval(x-radius/2,y-radius/2,radius,radius);
    g.setColor(rim);
    for (int i=0; i < thick; i++) {
           g.drawOval(x-radius/2+i,y-radius/2+i,radius-2*i,radius-2*i);
    }
  }

  public void dl(Graphics g, int i1, int i2, int thick) {
    for (int i = -thick; i < thick + 1; i++) {
      for (int j = -thick; j < thick + 1; j++) {
        g.drawLine(v[0][i1]+i,v[1][i1]+j,v[0][i2]+i,v[1][i2]+j);
      }
    }
  }


  public boolean keyUp(Event event, int keyCode) {
    if (keyCode == 120 || keyCode == 88 || keyCode == 113 || keyCode == 81) {
      System.exit(0);
    }
    return true;
  }

  public boolean mouseUp(Event evt, int x, int y) {
    System.exit(0);
    return true;
  }


}
