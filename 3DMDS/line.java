import java.awt.*;
import java.io.*;

class line {

    boolean dashed;

    int[] screen0, screen1;
    double[] space0, space1;
    boolean broken = false;
    line e1, e2;
    static double[] p = new double[3]; 

    line(int x0, int y0, int x1, int y1, double X0, double Y0, double Z0, double X1, double Y1, double Z1) {
        broken = false;
        screen0 = new int[2];
        screen1 = new int[2];        
        space0 = new double[3];
        space1 = new double[3];
	screen0[0] = x0;
        screen0[1] = y0;
	screen1[0] = x1;
        screen1[1] = y1;
        space0[0] = X0;
        space0[1] = Y0;
        space0[2] = Z0;
        space1[0] = X1;
        space1[1] = Y1;
        space1[2] = Z1;
    }
  
    void intersect(line x, line y) {
        if (x.broken) {
	    intersect(x.e1,y);
            intersect(x.e2,y);
	}        
        else if (y.broken) {
            intersect(x,y.e1);
            intersect(x,y.e2);
	}
        else {
            int x0 = x.screen0[0];
            int y0 = x.screen0[1];
            int x1 = x.screen1[0];
            int y1 = x.screen1[1];
            int u0 = y.screen0[0];
            int v0 = y.screen0[1];
            int u1 = y.screen1[0];
            int v1 = y.screen1[1];
            int denominator = (-y0*u0+y0*u1+y1*u0-y1*u1+v0*x0-v0*x1-v1*x0+v1*x1);
            if (denominator != 0) {
		int s = -(-y1*u0+y1*u1+v0*x1-v0*u1+v1*u0-v1*x1);
		int t = (y0*u1-y1*u1-v1*x0-x1*y0+x0*y1+v1*x1);  
		if (denominator < 0) {
		    denominator = -denominator;
		    s = -s;
		    t = -t;
		}
		if (0 < s && s < denominator && 0 < t && t < denominator) {
                    double ss = ((double) s)/((double) denominator);   
                    double xx = ss*x.space0[0] + (1.0-ss)*x.space1[0];                    
                    double yy = ss*x.space0[1] + (1.0-ss)*x.space1[1];                    
                    double zz = ss*x.space0[2] + (1.0-ss)*x.space1[2];                    
                    double dx = p[0]*xx+p[1]*yy+p[2]*zz;
                    double tt = ((double) t)/((double) denominator);   
                    xx = tt*y.space0[0] + (1.0-tt)*y.space1[0];                    
                    yy = tt*y.space0[1] + (1.0-tt)*y.space1[1];                    
                    zz = tt*y.space0[2] + (1.0-tt)*y.space1[2];                    
                    double dy = p[0]*xx+p[1]*yy+p[2]*zz;
                    if (dy < dx) {
			breakIt(x,ss);
		    }
                    else if (dy > dx) {
                        breakIt(y,tt);
		    }
		}
	    }
	}
    }

    void breakIt (line x, double t) {
	x.broken = true;
        double length = sqrt((x.screen0[0]-x.screen1[0])*(x.screen0[0]-x.screen1[0])+(x.screen0[1]-x.screen1[1])*(x.screen0[1]-x.screen1[1]));
        double breakPoint = 10.0/length;
        double t1 = min(1.0,t+breakPoint);
        double t2 = max(0.0,t-breakPoint);
        x.e1 = new line(x.screen0[0],x.screen0[1],
                        (int) (t1*x.screen0[0]+(1.0-t1)*x.screen1[0]), (int) (t1*x.screen0[1]+(1.0-t1)*x.screen1[1]),
                        x.space0[0],x.space0[1],x.space0[2],
                        t1*x.space0[0]+(1.0-t1)*x.space1[0],t1*x.space0[1]+(1.0-t1)*x.space1[1],t1*x.space0[2]+(1.0-t1)*x.space1[2]);
        x.e2 = new line((int) (t2*x.screen0[0]+(1.0-t2)*x.screen1[0]),(int) (t2*x.screen0[1]+(1.0-t2)*x.screen1[1]),
                        x.screen1[0],x.screen1[1],
                        t2*x.space0[0]+(1.0-t2)*x.space1[0],t2*x.space0[1]+(1.0-t2)*x.space1[1],t2*x.space0[2]+(1.0-t2)*x.space1[2],
                        x.space1[0],x.space1[1],x.space1[2]);
        x.e1.dashed = x.dashed;
        x.e2.dashed = x.dashed;
    }

    void draw(Graphics g, Color c, int thickness) {
        if (broken) {
	    e1.draw(g,c,thickness);
	    e2.draw(g,c,thickness);
	}
        else {
	    g.setColor(c);
            for (int i = -thickness; i <= thickness; i++) {
		for (int j = -thickness; j <= thickness; j++) {
                    if (!dashed) {
			g.drawLine(screen0[0]+i,screen0[1]+j,screen1[0]+i,screen1[1]+j);
		    }
		    else {
			int dist = (int) java.lang.Math.sqrt((screen0[0]-screen1[0])*(screen0[0]-screen1[0]) 
							     +(screen0[1]-screen1[1])*(screen0[1]-screen1[1]));
                        int steps = dist/10;
                        if (steps % 2 == 0) {
			    steps++;
			}
                        for (int k = 0; k < steps; k++ ) {
                            if (k%2 == 0) {
				double tau = ((double) k)/((double) steps);
                                int x0 = (int) (tau*screen0[0] +  (1.0-tau)*screen1[0]+i);
                                int y0 = (int) (tau*screen0[1] +  (1.0-tau)*screen1[1]+j);
				tau = ((double) k+1)/((double) steps);                                
                                int x1 = (int) (tau*screen0[0] +  (1.0-tau)*screen1[0]+i);
                                int y1 = (int) (tau*screen0[1] +  (1.0-tau)*screen1[1]+j);
				g.drawLine(x0, y0, x1, y1);
			    }
			}
		    }
		}
	    }
	}
    }

    double min(double a, double b) {
	if ( a < b) {return a;} else {return b;}
    }

    double max(double a, double b) {
	if ( a > b) {return a;} else {return b;}
    }

    void debug(String s) {
        System.out.println(s);
    }

    double sqrt(double x) {
        return java.lang.Math.sqrt(x);
    }


    void psDraw(PrintWriter out, Color c, int thickness) {
        if (broken) {
	    e1.psDraw(out,c,thickness);
	    e2.psDraw(out,c,thickness);
	}
        else {
	    float[] rgb = new float[3];
            c.getColorComponents(rgb);
            String edge = ps(rgb[0]) + " " + ps(rgb[1]) + " " + ps(rgb[2]) + " sc ";
            edge = edge + thickness + " slw ";
	    if (dashed) {
		edge = edge + " [5 5] 10 sd ";
	    }
	    else {
		edge = edge + " [] 0 sd ";
	    }
	    edge = edge + psx(screen0[0]) + " " + psy(screen0[1]) + " M " + psx(screen1[0]) + " " + psy(screen1[1]) + " L S " ;
	    out.println(edge);
	}
    }

    String ps(double x) {
	return tv.Config.ps(x);
    }

    String psx(int i) {
	return tv.Config.ps(tv.Config.psx(i));
    }

    String psy(int i) {
	return tv.Config.ps(tv.Config.psy(i));
    }

}
