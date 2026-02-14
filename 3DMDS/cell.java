/* Note: To create the files needed for downloading cells
   run this program self contained:

   java cell

*/

import java.io.*;

public class cell 
    implements Serializable {

    int T, V;

    int[][] triags;
    int[] vtcs;
    int[][][] degrees;
    int maxDegree, minDegree;
    long[] identify;    
    long maxCode;
    config own;
    double[][] points;
    static final double pi = 2.0*acos(0.0);
    boolean initialized = false;

    boolean areaOK = true;


    /* 
       degrees[vertex][0][0] degree of vertex
       degrees[vertex][i][0] degree of neighboring vertex i, i = 1...degree
       degrees[vertex][i][1] index  of neighboring vertex i, i = 1...degree
       Note that the neighbor numbering starts at 1.
    */


    int[][] splits;
    int splitMax = 3;

    /* splits keeps track of how the cell was built by vertex splitting.
       We start with the tetrahedron
       int[i][0] contains the index of the vertex that was split in the i-th split
       ni = int[i][1] contains the number of old edges attached to the new vertex
       nd = int[i][2] contains the degree of the split vertex before spplitting
       int[i][3..ni+2] contains the indices of the ni old vertices attached
       to the new vertex 
       int[i][ni+3..nd+2] contains the indices of the remaining vertices attached to the old vertex.

       This information is used to build the geometry when rendering this cell 
   
       splitMax is th emaximum degree encountered in the splitting process;

    */

    public static void main(String[] args) {
        int N = 100000;
        cell[] c = new cell[N];
        int n = 1;
        int t = 0;
        int v = 1;
        int i1 = 1;
        int i2 = 2; 
        c[0] = origin();
        c[0].init();
        int vs = c[0].V;
	int count = 1;
        while (n < N) {
	    cell p = spawn(c[t],v,i1,i2);
            boolean newCell = true;
            for (int i = 1; i < n; i++) {
                if (sameness(p,c[i]) == 2) {
		    write(" sameness 2 ");
                    p.report();
                    c[i].report();
		}
		if (sameness(p,c[i]) == 3) {
                    newCell = false;
                    i = n;
		}
	    }
            if (newCell) {
		c[n] = p;
                n++;
                if (p.V > vs) {
		    write(vs + " " + count);
                    try{
			String file = "cells." + vs;
			ObjectOutputStream out = new ObjectOutputStream(new FileOutputStream(file));
			cell[] d = new cell[n];
			for (int i = 0; i < n; i++) {
			    d[i] = c[i];
			}
			out.writeObject(d);
			out.close();
		    }
		    catch(java.io.FileNotFoundException e) {
			write(" file not found " + e);
		    }
		    catch(java.io.IOException e) {
			write(" IOException " + e);
		    }
                    vs = p.V;
                    count = 1;
		}
                else {
		    count++;
		}
	    }
            i2++;
            if (i2 > c[t].degrees[v][0][0]) {
                i1++;
                i2 = i1+1;
                if (i1 > c[t].degrees[v][0][0]-1) {
		    v++;
                    i1 = 1;
                    i2 = 2;
                    if (v > c[t].V-1) {
			t++;
                        v = 1;
		    }
		}
	    }
	}
    }


    static int sameness(cell C1, cell C2) {
	/*
	  Two cells C1 and C2 have sameness:
	  0: the number of vertices is different
	  1: same numbers of vertices, but the sets of vertex degrees are different
	  2: same sets of vertex degrees, but different sequences for some vertices      
	  3: same sequences, but can't go from on to the other by relabeling
	  4: can get one from to the other by relabeling the vertices.
   
	  sameness 4 means essential equivalence (except for geometric variations)
	  triangulations of sameness 2 are presently unknown.
    
          computing samenss 4 is currently not implemented.

          triangulations of sameness 2 are unknown

          could consider samenes 5 if geometries are affinely related
          (for example)

        */
 
        if (C1.V != C2.V) {
            return 0;
	}
	for (int i = 1; i < C1.V; i++) {
	    if (C1.degrees[C1.vtcs[i]][0][0] != C2.degrees[C2.vtcs[i]][0][0]) {
		return 1;
	    }
	}
	for (int i = 1; i < C1.V; i++) {
	    if (C1.degrees[C1.vtcs[i]][0][1] != C2.degrees[C2.vtcs[i]][0][1]) {
		return 2;
	    }
	}
        return 3;
    }

    public cell() {
    }

    static cell origin() {
        cell C = new cell();
        C.T = 4;
        C.V = 5;
        C.triags = new int[C.T][4];
        C.triags[0][0] = 1; C.triags[0][1] = 2; C.triags[0][2] = 3;
        C.triags[1][0] = 4; C.triags[1][1] = 2; C.triags[1][2] = 3;
        C.triags[2][0] = 1; C.triags[2][1] = 4; C.triags[2][2] = 3;
        C.triags[3][0] = 1; C.triags[3][1] = 2; C.triags[3][2] = 4;
        C.init();
        return C;
    }

    static cell spawn(cell C, int vertex, int i1, int i2) {
        cell c = new cell();
	/* in cell C, split vertex
	   The new vertex will have edges i1, i1 + 1, i2 + 1, ..., i2
	   attached to it.  Edges i1 and i2 will be duplicated. We assume
	   that i1 < i2.  (If the edges attached to the new vertex
	   are the complement of this set then an equivalent configuration
	   can be obtained by interchanging the labels of the old and new vertex.)
        */
        int degree = C.degrees[vertex][0][0];
        if (i2 <= i1 || i1 > degree || i2 > degree) {
	    write(" cannot spawn ");
            C.report();
            write(" vertex = " + vertex + "i12 = " + i1 + " i2 = " + i2);
            return new cell();
	}
        int newV = C.V + 1;
        c.V = newV;
        c.T = C.T + 2;
        c.triags = new int[c.T][4];
        for (int i = 0; i < C.T; i++) {
	    c.triags[i][0] = C.triags[i][0];
	    c.triags[i][1] = C.triags[i][1];
	    c.triags[i][2] = C.triags[i][2];
	}
        for (int i = i1; i < i2; i++) {
            for (int t = 0; t < C.T; t++) {
		int neighbor1 = C.degrees[vertex][i][1];
		int neighbor2 = C.degrees[vertex][i+1][1];
		if (c.in(neighbor1,t) && c.in(neighbor2,t) && c.in(vertex,t)) {
		    c.replace(t,vertex,C.V);
		}
	    }
	}
        c.triags[C.T][0] = vertex;
        c.triags[C.T][1] = C.V;
        c.triags[C.T][2] = C.degrees[vertex][i1][1];
        c.triags[C.T+1][0] = vertex;
        c.triags[C.T+1][1] = C.V;
        c.triags[C.T+1][2] = C.degrees[vertex][i2][1];
        c.init();

        /* record splits */
        c.splitMax = C.splitMax;
        if (C.maxDegree > C.splitMax) {
	    c.splitMax = C.maxDegree;
	}
       	c.splits = new int[c.V-4][c.splitMax+3];
        if (C.V > 5) {
	    for (int i = 0; i < C.V-4; i++) {
		int d = C.splits[i][2];
		for (int j = 0; j < d+3; j++) {
		    c.splits[i][j] = C.splits[i][j];
		}
	    }
	}
	c.splits[C.V-5][0] = vertex;
	c.splits[C.V-5][1] = i2-i1+1;
	degree = C.degrees[vertex][0][0];
	c.splits[C.V-5][2] = degree;
	int ncount = 2;
	for (int j = i1; j <= i2; j++) {
	    ncount++;
	    c.splits[C.V-5][ncount] = C.degrees[vertex][j][1];
	}
	for (int j = 1; j <i1; j++) {
	    ncount++;
	    c.splits[C.V-5][ncount] = C.degrees[vertex][j][1];
	}
	for (int j = i2+1; j <= degree; j++) {
	    ncount++;
	    c.splits[C.V-5][ncount] = C.degrees[vertex][j][1];
	}
        return c;
    }

    void replace (int t, int V, int newV) {
        if (triags[t][0] == V) {
	    triags[t][0] = newV;
	}
        else if (triags[t][1] == V) {
	    triags[t][1] = newV;
	}
        else if (triags[t][2] == V) {
	    triags[t][2] = newV;
	}
        else {
	    write (" nothing to replace, t = " + t + ", V = " + V + ", newV = " + newV);
            report();
	}
    }

    void init() {
        maxCode = 2;
        for (int i = 0; i < 61; i++) {
            maxCode = maxCode + maxCode;
	}
        long mCm1 = maxCode - 1;
        maxCode = maxCode + mCm1;
        for (int i = 0; i < T; i++) {
	    boolean sorted = false;
            while (!sorted) {
                sorted = true;
		for (int j = 1; j < 3; j++) {
                    if (triags[i][j] < triags[i][j-1]) {
			int dmy = triags[i][j];
                        triags[i][j] = triags[i][j-1];
                        triags[i][j-1] = dmy;
                        sorted = false;
		    }
		}
	    }
	}
        vtcs = new int[V];
        for (int i = 1; i < V; i++) {
	    vtcs[i] = i;
	}
        degrees = new int[V][V][2];
        identify = new long[V];
        for (int i = 0; i < T; i++) {
	    for (int j = 0; j < 4; j++) {
		degrees[triags[i][j]][0][0]++;        
	    }
	}
        maxDegree = 0;
        minDegree = V+1;
        for (int i = 1; i < V; i++) {
            if (degrees[i][0][0] > maxDegree) {
		maxDegree = degrees[i][0][0];
	    }
            if (degrees[i][0][0] < minDegree) {
                minDegree = degrees[i][0][0];
	    }
	}
        for (int v = 1; v < V; v++) {
            for (int mu = 0; mu < T; mu++) {
		for (int nu = 0; nu < 4; nu++) {
		    if (v == triags[mu][nu]) {
			/*we start in triangle mu */
                        int i0 = triags[mu][0];
                        int i1 = triags[mu][1];
                        if (nu == 0) {
			    i0 = triags[mu][1];
			    i1 = triags[mu][2];
			}
                        if (nu == 1) {
			    i1 = triags[mu][2];
			}
                        int degree = degrees[v][0][0];
                        for (int k = 1; k <= degree; k++) {
                            degrees[v][k][0] = degrees[i0][0][0];
                            degrees[v][k][1] = i0;
                            for (int rho = mu; rho < T; rho++) {
				if (!in(i0,rho) && in(i1,rho) && in(v,rho)) {
                                    int inew = triags[rho][0];
                                    if (inew == v || inew == i1) {
                                        inew = triags[rho][1];
				    }
                                    if (inew == v || inew == i1) {
                                        inew = triags[rho][2];
				    }
                                    i0 = i1;
                                    i1 = inew;
                                    rho = T;
				}
			    }
			}
			mu = T;
			nu = 4;
		    }
		}
	    }
            identify[v] = code(v);
	}
	vtcs = new int[V];
        for (int i = 1; i < V; i++) {
	    vtcs[i] = i;
	}
        boolean sorted = false;
        while (!sorted) {
	    sorted = true;
            for (int i = 2; i < V; i++) {
		if ( (degrees[vtcs[i]][0][0] < degrees[vtcs[i-1]][0][0]) ||
		     (degrees[vtcs[i]][0][0] == degrees[vtcs[i-1]][0][0] && degrees[vtcs[i]][0][1] < degrees[vtcs[i-1]][0][1]) ) {
		    int dmy = vtcs[i];
                    vtcs[i] = vtcs[i-1];
                    vtcs[i-1] = dmy;
                    sorted = false;
		}
	    }
	}
        initialized = true;
    }

    void report() {
        if (!initialized) {
	    init();
	}
        write ("\ncell:");
	write(T + " triangles: ");
        for (int i = 0; i < T; i++) {
	    String s = i + ": " + triags[i][0] + " " + triags[i][1] + " "+ triags[i][2];
            write(s);
	}
	write(V + " vertices: ");
        write("0: " + (V-1));
        for (int k = 1; k < V; k++) {
            int i = vtcs[k];
	    String s = i + ": " + degrees[i][0][0] + " - " + identify[i] + " -> ";
            for (int j = 1; j <= degrees[i][0][0]; j++) {
                s = s + degrees[i][j][0] + "(" + degrees[i][j][1] + ") ";
            }
            write(s);
	}
        write(minDegree + " <= degree <= " + maxDegree);
        if (own != null) {
	    Points();
	}
        if (splits != null) {
	    write(" splitting history: ");
            for (int i =0; i < V-5; i++) {
		String s = i + " " + splits[i][0] +": " + splits[i][1] + " " +splits[i][2];
                for (int j = 3; j < 3+splits[i][2]; j++) {
                    s = s + " " + splits[i][j];
		}
		write(s);
	    }
	}
        write("---\n");
        checkArea(true);
        status();
    }

    void status() {
        int VB = V-1;
        String s = " VB= " + VB + " T = " + T + "  " +minDegree + " <= degree <= " + maxDegree;
        tv.CC.Status.setText(s);
    }

    static void write(String s) {
	System.out.println(s);
    }

    static void debug(String s) {
	System.out.println(s);
    }

    boolean in (int vertex, int triangle) {
        if (vertex == triags[triangle][0] || vertex == triags[triangle][1] || vertex == triags[triangle][2]) {
	    return true;
	}
        else {
	    return false;
	}
    }
    
    long code(int v) {
        int degree = degrees[v][0][0];
        int base = maxDegree - 2;
        if (base == 1) {
	    return 0;
	}
        long result = maxCode;
        for (int direction = -1; direction < 2; direction = direction + 2) {
	    for (int start = 1; start <= degree; start ++) {
		long trial = 0;
		int k = start;
		for (int i = 1; i <= degree; i++) {
		    trial = trial*base + degrees[v][k][0] - 3;
		    k = k + direction;
		    if (k < 1) {
			k = k + degree;
		    }
		    if (k > degree) {
			k = k - degree;
		    }
		}
		if (trial < result) {
		    result = trial;
		}
	    }
	}
        return result;
    }

    config C() {
	if (own == null) {
	    own = new config(0);
            own.N = T;
            own.V = V;
            own.vtcs = new int[V][3];
            own.tets = new int[T][4];
            for (int i = 0; i < T; i++) {
		own.newTet(i,0,triags[i][0],triags[i][1],triags[i][2]);
	    }
            own.newPoint(0,0,0,0);
            points = new double[V][3];
            points[1][0] = 0.0;
            points[1][1] = 0.0;
            points[1][2] = 1.0;
            double psi = -pi/6;
            double lambda2 = 0.0;            
            double lambda3 = 2.0*pi/3;
            double lambda4 = 4.0*pi/3;
            points[2][0] = cos(psi)*cos(lambda2);
            points[2][1] = cos(psi)*sin(lambda2);
            points[2][2] = sin(psi);
            points[3][0] = cos(psi)*cos(lambda3);
            points[3][1] = cos(psi)*sin(lambda3);
            points[3][2] = sin(psi);
            points[4][0] = cos(psi)*cos(lambda4);
            points[4][1] = cos(psi)*sin(lambda4);
            points[4][2] = sin(psi);
            for (int i = 5; i < V; i++) {
                double[] p = new double[3];
                double[] q = new double[3];
                double[] u = new double[3];
                double[] v = new double[3];
                double[] w = new double[3];
                double[] z = new double[3];
		int j = i-5;
                int vertex = splits[j][0];
                int pull = splits[j][1];
                int degree = splits[j][2];
                double alpha = pi;
                for (int mu = 3; mu < 3+degree; mu++) {
		    int k = splits[j][mu];
                    double t = acos(points[vertex][0]*points[k][0] 
				    + points[vertex][1]*points[k][1] 
				    + points[vertex][2]*points[k][2]);
                    if (t < alpha) {
			alpha = t;
		    }
		}
                alpha = alpha/4;
                for (int mu = 0; mu < 3; mu++) {
                    p[mu] = points[vertex][mu];
		    u[mu] = points[splits[j][3]][mu];
                    v[mu] = points[splits[j][3+pull-1]][mu];
		}
                double pTu = p[0]*u[0]+p[1]*u[1]+p[2]*u[2];
		double pTv = p[0]*v[0]+p[1]*v[1]+p[2]*v[2]; 
		if (abs(pTu) > 1.0e-12) {
 		    for (int mu = 0; mu < 3; mu++) {
 			u[mu] = p[mu] - 1.0/pTu*u[mu];
 		    }
 		}
		if (abs(pTv) > 1.0e-12) {
 		    for (int mu = 0; mu < 3; mu++) {
 			v[mu] = p[mu] - 1.0/pTv*v[mu];
 		    }
 		}
		if (pTu > 0.0) {
 		    for (int mu = 0; mu < 3; mu++) {
 			u[mu] = -u[mu];
 		    }
 		}
		if (pTv > 0.0) {
 		    for (int mu = 0; mu < 3; mu++) {
 			v[mu] = -v[mu];
 		    }
		}
                double norm = sqrt(u[0]*u[0]+u[1]*u[1]+u[2]*u[2]);
                for (int mu = 0; mu < 3; mu++) {
                    u[mu] = u[mu]/norm;
		}
                norm = sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);
                for (int mu = 0; mu < 3; mu++) {
                    v[mu] = v[mu]/norm;
		}
		double Norm = sqrt((u[0]+v[0])*(u[0]+v[0]) +(u[1]+v[1])*(u[1]+v[1]) +(u[2]+v[2])*(u[2]+v[2]));
 		if (Norm < 1.0E-12) {
 		    z[0] = u[1]*points[vertex][2] - u[2]*points[vertex][1];
 		    z[1] = u[2]*points[vertex][0] - u[0]*points[vertex][2];
 		    z[2] = u[0]*points[vertex][1] - u[1]*points[vertex][0];
		    norm = sqrt(z[0]*z[0]+z[1]*z[1]+z[2]*z[2]);
		    z[0] = z[0]/norm;
		    z[1] = z[1]/norm;
		    z[2] = z[2]/norm;
		}
		else {
 		    for (int mu = 0; mu < 3; mu++) {
 			z[mu] = (u[mu] + v[mu])/2.0;
 		    }
 		    norm = sqrt(z[0]*z[0]+z[1]*z[1]+z[2]*z[2]);
 		    for (int mu = 0; mu < 3; mu++) {
 			z[mu] = z[mu]/norm;
 		    }
		}
                boolean change = false;
                if (pull > 2) {
		    change = false;
		    for (int k = 4; k < 3+pull; k++) {
			int mu = splits[j][k];
			q[0] = points[mu][0];
			q[1] = points[mu][1];
			q[2] = points[mu][2];
			double ca = q[0]*z[0] + q[1]*z[1] + q[2]*z[2];
			double cb = p[0]*z[0] + p[1]*z[1] + p[2]*z[2];
			double cc = p[0]*q[0] + p[1]*q[1] + p[2]*q[2];
			double sa = sin(acos(ca));
			double sb = sin(acos(cb));
			double sc = sin(acos(cc));
			double calpha = (ca-cb*cc)/(sb*sc);
			if(calpha < 0.0) {
 			    change = true;
			    k = 3 + pull;
			}
		    }
		    if (change) {
			for (int mu = 0; mu < 3; mu++) {
			    z[mu] = -z[mu];
			}
		    }
		}
		for (int mu = 0; mu < 3; mu++) {
		    points[i][mu] = cos(alpha)*p[mu] + sin(alpha)*z[mu];
		    points[vertex][mu] = cos(alpha)*p[mu] - sin(alpha)*z[mu];
		}
	    }
            for (int i = 1; i < V; i++) {
                int x0 = convert(points[i][0]);
                int x1 = convert(points[i][1]);
                int x2 = convert(points[i][2]);
                own.newPoint(i,x0,x1,x2);
	    }
	}
	checkArea();
	return own;
    }

    void enlarge (int v) {
        enlarge(v, 1.0);
    }

    void enlarge (int v, double factor) {
        if (factor > 0.0001) {
	    double[][] oldPoints = new double[V][3];
	    for (int i = 0; i < V; i++) {
		for (int j = 0; j < 3; j++) {
		    oldPoints[i][j] = points[i][j];
		}
	    }
	    if (v > 0 && v <V && own != null) {
		double[] q = new double[3];
		for (int mu = 0; mu < 3; mu++) {
		    q[mu] = points[v][mu]/2.0;
		}
		for (int i = 1; i < V; i++) {
		    for (int mu = 0; mu < 3; mu++) {
			points[i][mu] = points[i][mu] - q[mu]*factor;
		    }
		    nrmlz(i);
		}
		for (int i = 1; i < V; i++) {
		    int x0 = convert(points[i][0]);
		    int x1 = convert(points[i][1]);
		    int x2 = convert(points[i][2]);
		    own.newPoint(i,x0,x1,x2);
		    tv.Config.newPoint(i,x0,x1,x2);
		}
		checkArea();
                if (areaOK) {
		    tv.CC.showIt();
		}
                else {
		    for (int i = 0; i < V; i++) {
			for (int j = 0; j < 3; j++) {
			    points[i][j] = oldPoints[i][j];
			}
		    }
		    enlarge (v, factor/2.0);
		}
	    }
	}
        else { 
            String s = " cannot enlarge ";
	    write(s);
	    tv.CC.Status.setText(s);
	}
    }



    void center() {
	center(1.0);
    }

    void center(double factor) {
        if (points == null) {
            init();
	}
        if (factor > 0.0001) {
	    double[] c = new double[3];
	    double[][] oldPoints = new double[V][3];
	    for (int i = 0; i < V; i++) {
		for (int j = 0; j < 3; j++) {
		    oldPoints[i][j] = points[i][j];
		}
	    }
	    for (int i = 0; i < 3; i++) {
		c[i] = 0.0;
		for (int j = 1; j < V; j++) {
		    c[i] = c[i] + points[j][i];
		}
		c[i] = c[i]/(V-1);
	    }
	    for (int i = 1; i < V; i++) {
		for (int j = 0; j < 3; j++) {
		    points[i][j] = points[i][j] - c[j]*factor;
		}
		nrmlz(i);
	    }
	    for (int i = 1; i < V; i++) {
		int x = convert(points[i][0]);
		int y = convert(points[i][1]);
		int z = convert(points[i][2]);
		own.newPoint(i,x,y,z);
	    }
	    checkArea();
	    if (areaOK) {
		tv.CC.showIt();
	    }
	    else {
		for (int i = 0; i < V; i++) {
		    for (int j = 0; j < 3; j++) {
			points[i][j] = oldPoints[i][j];
		    }
		}
		center (factor/2.0);
	    }
	}
        else { 
            String s = " cannot center ";
	    write(s);
	    tv.CC.Status.setText(s);
	}
    }


    void nrmlz(int v) {
	double norm = sqrt(points[v][0]*points[v][0]+points[v][1]*points[v][1]+points[v][2]*points[v][2]);
        points[v][0] = points[v][0]/norm;
        points[v][1] = points[v][1]/norm;
        points[v][2] = points[v][2]/norm;
    }

    void checkArea() {
        checkArea(false);
    }

    void checkArea(boolean writeIt) {
        double a = 0.0;
	for (int i = 0; i < T; i++) {
	    a = a + area(i);
	}
        if (abs(a-4.0*pi) > 0.000000001) {
	    if (writeIt) {
		String s = " bad area " + a;
		write(s);
		if (tv.CC != null) {
		    tv.CC.Status.setText(s);
		}
	    }
	    areaOK = false;
	}
        else {
            if (writeIt) {
		if (tv.CC != null) {
		    tv.CC.Status.setText(" area OK");
		    write(" area OK");
		}
	    }
	    areaOK = true;
	}
    }

    int convert (double z) {
	double h = 200.0*z;
        if (h < 0.0) { h = h-0.5; }
        if (h > 0.0) { h = h+0.5; }
        return (int) h;
    }


    void Points() {
        write("Points:");
        for (int i = 0; i< V; i++) {
            double n = sqrt(points[i][0]*points[i][0] + points[i][1]*points[i][1] + points[i][2]*points[i][2]);
	    write(i +": " + round(points[i][0]) + " " + round(points[i][1]) + " " + round(points [i][2]) + " ... " + round(n));
	}
        write("areas:");
        double sum = 0.0;
        for (int i = 0; i < T; i++) {
            double a = area(i);
            sum = sum + a;
            write(i + ": " + triags[i][0] + " " +  triags[i][1] + " " + triags[i][2] + " " + round(a));
	}
        write(" total area = " + round(sum));
    }    

    double round(double z) {
	int zz = (int) (10000.0*z);
        return (double) zz/10000.0;
    }

    void normal(int i) {
	double x = points[i][0];
	double y = points[i][1];
	double z = points[i][2];
        double norm = sqrt(x*x+y*y+z*z);
        points[i][0] = points[i][0]/norm;
        points[i][1] = points[i][1]/norm;
        points[i][2] = points[i][2]/norm;
    }

    double sqrt(double x) {
	return java.lang.Math.sqrt(x);
    }

    double area(int i) {
	int i0 = triags[i][0];
	int i1 = triags[i][1];
	int i2 = triags[i][2];
	double x0 = points[i0][0];
	double y0 = points[i0][1];
	double z0 = points[i0][2];
	double x1 = points[i1][0];
	double y1 = points[i1][1];
	double z1 = points[i1][2];
	double x2 = points[i2][0];
	double y2 = points[i2][1];
	double z2 = points[i2][2];
        double a = acos(x0*x1+y0*y1+z0*z1);
        double b = acos(x0*x2+y0*y2+z0*z2);      
        double c = acos(x1*x2+y1*y2+z1*z2);
        double s = (a+b+c)/2;
        double alpha = 2.0*atan(sqrt(sin(s-b)*sin(s-c)/sin(s)/sin(s-a)));
        double beta = 2.0*atan(sqrt(sin(s-c)*sin(s-a)/sin(s)/sin(s-b)));
        double gamma = 2.0*atan(sqrt(sin(s-a)*sin(s-b)/sin(s)/sin(s-c)));
        double ar = alpha + beta + gamma - pi;
        return ar;
    }

    double tarea(int i) {
	int x = triags[i][0];
	int y = triags[i][1];
	int z = triags[i][2];
	double x0 = points[x][0]; double x1 = points[x][1];
	double y0 = points[y][0]; double y1 = points[y][1];
	double z0 = points[z][0]; double z1 = points[z][1];
	return abs(x0*y1 - x0*z1 - x1*y0 + x1*z0 + y0*z1 - z0*y1);
    }

    void nice() {
	nice(1.0);
    }

    void nice(double factor) {
        if (factor > 0.0001) {
	    if (points != null) {
		double[][] oldPoints = new double[V][3];
		for (int i = 0; i < V; i++) {
		    for (int j = 0; j < 3; j++) {
			oldPoints[i][j] = points[i][j];
		    }
		}
		double average = 4*pi/T;
		for (int n = 0; n < T; n++) {
		    double a = area(n);
		    if (a > average) {
			double shrink = factor*sqrt(average/a) + 1.0 - factor;
			double[] c = new double[3];
			for (int k = 0; k < 3; k++) {
			    c[k] = 0.0;
			    for (int mu = 0; mu < 3; mu++) {
				c[k] = c[k] + points[triags[n][mu]][k]/3.0;
			    }
			}
			for (int mu = 0; mu < 3; mu++) {
			    for(int k = 0; k < 3; k++) {
				points[triags[n][mu]][k] = shrink*points[triags[n][mu]][k] + (1.0-shrink)*c[k];
			    }
			}
		    }
		}
		for (int i = 0; i < V; i++) {
		    double norm = 0.0;
		    for (int j = 0; j < 3; j++) {
			norm = norm + points[i][j]*points[i][j];
		    }
		    norm = sqrt(norm);
		    for (int j = 0; j < 3; j++) {
			points[i][j] = points[i][j]/norm;
		    }            
		    int x = convert(points[i][0]);
		    int y = convert(points[i][1]);
		    int z = convert(points[i][2]);
		    own.newPoint(i,x,y,z);
		}
		checkArea();
                if (areaOK) {
		    tv.CC.showIt();
		}
                else {
		    for (int i = 0; i < V; i++) {
			for (int j = 0; j < 3; j++) {
			    points[i][j] = oldPoints[i][j];
			}
		    }
		    nice (factor/2.0);
		}

	    }
	}
        else {
            String s = " cannot nice it ";
	    write(s);
	    tv.CC.Status.setText(s);
	}
    }

    void reset() {
	own = null;
        init();
	tv.CC.showIt();
	checkArea();
    }


    static double acos(double z) {
        return java.lang.Math.acos(z);
    }

    static double sin(double z) {
        return java.lang.Math.sin(z);
    }

    static double cos(double z) {
        return java.lang.Math.cos(z);
    }

    static double atan(double z) {
        return java.lang.Math.atan(z);
    }

    static double asin(double z) {
        return java.lang.Math.asin(z);
    }

    static double abs(double z) {
        return java.lang.Math.abs(z);
    }

    static double dg(double z) {
        return z/pi*180.0;
    }
}			    
 
