import java.io.*;

public class facet implements Serializable {
     
    int V = tv.Config.V;

    int[][] done = new int[4][14];
    
    int[] vertex = new int[4];

    /* done[i][4][0] == 0 means marked, -1 means not marked */

    void mark (int v) {
        for (int j = 10; j < 14; j++) {
	    if (done[0][j] == v) {
                done[3][j] = 0;
	    }
	}
    }

    void mark (int e1, int e2) {
        for (int j = 4; j < 10; j++) {
	    if (done[0][j] == e1 && done[1][j] == e2) {
                done[3][j] = 0;
	    }
	}
    }

    void mark (int f1, int f2, int f3) {
        for (int j = 0; j < 4; j++) {
	    if (done[0][j] == f1 && done[1][j] == f2 && done[2][j] == f3) {
                done[3][j] = 0;
	    }
	}
    }

    void unmark (int v) {
        for (int j = 10; j < 14; j++) {
	    if (done[0][j] == v) {
                done[3][j] = -1;
	    }
	}
    }

    void unmark (int e1, int e2) {
        for (int j = 4; j < 10; j++) {
	    if (done[0][j] == e1 && done[1][j] == e2) {
                done[3][j] = 1;
	    }
	}
    }

    void unmark (int f1, int f2, int f3) {
        for (int j = 0; j <= 3; j++) {
	    if (done[0][j] == f1 && done[1][j] == f2 && done[2][j] == f3) {
                done[3][j] = -1;
	    }
	}
    }

    void init() {
	for (int i = 0; i < 14; i++) {
	    for (int j = 0; j < 4; j++) {
		done[j][i] = -1;
	    }
	}
	int i = 0; done[0][i] = vertex[0]; done[1][i] = vertex[1]; done[2][i] = vertex[2]; // face 0 1 2
	i = 1; done[0][i] = vertex[0]; done[1][i] = vertex[1]; done[2][i] = vertex[3]; // face 0 1 3
	i = 2; done[0][i] = vertex[0]; done[1][i] = vertex[2]; done[2][i] = vertex[3]; // face 0 2 3
	i = 3; done[0][i] = vertex[1]; done[1][i] = vertex[2]; done[2][i] = vertex[3]; // face 1 2 3
	i = 4; done[0][i] = vertex[0]; done[1][i] = vertex[1]; // edge 0 1
	i = 5; done[0][i] = vertex[0]; done[1][i] = vertex[2]; // edge 0 2
	i = 6; done[0][i] = vertex[0]; done[1][i] = vertex[3]; // edge 0 3
	i = 7; done[0][i] = vertex[1]; done[1][i] = vertex[2]; // edge 1 2
	i = 8; done[0][i] = vertex[1]; done[1][i] = vertex[3]; // edge 1 3
	i = 9; done[0][i] = vertex[2]; done[1][i] = vertex[3]; // edge 2 3
	i = 10; done[0][i] = vertex[0]; //vertex 0
	i = 11; done[0][i] = vertex[1]; //vertex 1
	i = 12; done[0][i] = vertex[2]; //vertex 2
	i = 13; done[0][i] = vertex[3]; //vertex 3
    }

    facet(int i0, int i1, int i2, int i3) {
        vertex[0] = i0;
        vertex[1] = i1;
        vertex[2] = i2;
        vertex[3] = i3;
	init();
    }

    void write(String s) {
	System.out.println(s);
    }

    void debug(String s) {write(s);}
 
    void report() {
	write(" facet report: " + vertex[0] + " " + vertex[1] + " " + vertex[2] + " " + vertex[3]);
        for (int f = 0; f < 4; f++) {
	    write(" face " + f + ": " + done[0][f] + " " + done [1][f] + " " + done[2][f] + " - " + done[3][f]);
	}
        for (int f = 4; f < 10; f++) {
	    write(" edge " + f + ": " + done[0][f] + " " + done [1][f]  + " - " + done[3][f]);
	}
        for (int f = 10; f < 14; f++) {
	    write(" vertex " + f + ": " + done[0][f]  + " - " + done[3][f]);
	}
        write(" building block " + which());
    }

    void unmark() {
        for (int f = 0; f < 4; f++) {
            if (done[3][f] == 0) {
		int i0 = done[0][f];
		int i1 = done[1][f];
		int i2 = done[2][f];
                unmark(i0,i1);
                unmark(i0,i2);
                unmark(i1,i2);
                unmark(i0);
                unmark(i1);
                unmark(i2);
	    }
	}
	for (int f = 4; f < 10; f++) {
	    if (done[3][f] == 0) {
		int i0 = done[0][f];
		int i1 = done[1][f];
                unmark(i0);
                unmark(i1);
	    }
	}
    }

    void count() {
        String s = "marked: ";
	for (int i = 0; i < 14; i++) {
	    if (done[3][i] == 0) {
		s = s + " " + i;
	    }
	}
        write(s);
    }

    boolean marked(int f) {
        if (done[3][f] == 0) {
	    return true;
	}
        else {
	    return false;
	}
    }

    int which() {
	int vs = 0;
        int es = 0;
        int fs = 0;
        for (int f = 0; f < 4; f++) {
	    if (marked(f)) {
		fs++;
	    }
	}
	for (int e = 4; e < 10; e++) {
	    if (marked(e)) {
		es++;
	    }
	}
	for (int v = 10; v < 14; v++) {
	    if (marked(v)) {
		vs++;
	    }
	}
        if(vs == 0 && es == 0 && fs == 0) {
	    return 0;
	}
        if(vs == 1 && es == 0 && fs == 0) {
	    return 1;
	}
        if(vs == 2 && es == 0 && fs == 0) {
	    return 2;
	}
        if(vs == 3 && es == 0 && fs == 0) {
	    return 3;
	}
        if(vs == 4 && es == 0 && fs == 0) {
	    return 4;
	}
        if(vs == 0 && es == 1 && fs == 0) {
	    return 5;
	}
        if(vs == 0 && es == 2 && fs == 0) {
            for (int e = 4; e < 10; e++) {
                if (marked(e)) {
		    mark(done[0][e]);
		    mark(done[1][e]);
		}
	    }
            int s = 0;
            for (int v = 10; v < 14; v++) {
		if (marked(v)) {
		    s++;
		}
	    }
            unmark();
            if (s == 4) {
		return 6;
	    }
            if (s == 3) {
                return 7;
	    }
	}
        if (vs == 0 && es == 3 && fs == 0) {
            for (int e = 4; e < 10; e++) {
                if (marked(e)) {
		    mark(done[0][e]);
		    mark(done[1][e]);
		}
	    }
            int s = 0;
            for (int v = 10; v < 14; v++) {
		if (marked(v)) {
		    s++;
		}
	    }
            unmark();
            if (s == 4) {
                int[] vtcs = new int[V];
		for (int e = 4; e < 10; e++) {
		    if (marked(e)) {
                        vtcs[done[0][e]]++;
                        vtcs[done[1][e]]++;
		    }
		}
		for (int v = 0; v < V; v++) {
		    if (vtcs[v] == 3) {
			return 9;
		    }
		}
		return 8;
	    }
            if (s == 3) {
		return 10;
	    }
	}
        if (vs == 0 && es == 4 && fs == 0) {
	    int[] vtcs = new int[V];
	    for (int e = 4; e < 10; e++) {
		if (marked(e)) {
		    vtcs[done[0][e]]++;
		    vtcs[done[1][e]]++;
		}
	    }
 	    if (vtcs[done[0][10]] == 2 && vtcs[done[0][11]] == 2 && vtcs[done[0][12]] == 2 && vtcs[done[0][13]] == 2) {
		return 11;
	    } 
	    else {
		return 12;
	    }
	}
        if (vs == 0 && es == 5 && fs == 0) {
	    return 13;
	}
        if (vs == 0 && es == 6 && fs == 0) {
	    return 14;
	}
        if (vs == 1 && es == 1 && fs == 0) {
	    return 15;
	}
        if (vs == 2 && es == 1 && fs == 0) {
	    return 16;
	}
        if (vs == 1 && es == 2 && fs == 0) {
	    return 17;
	}
        if (vs == 1 && es == 3 && fs == 0) {
	    return 18;
	}
        if (vs == 0 && es == 1 && fs == 1) {
	    return 19;
	}
        if (vs == 0 && es == 2 && fs == 1) {
	    return 20;
	}
        if (vs == 0 && es == 3 && fs == 1) {
	    return 21;
	}
        if (vs == 0 && es == 1 && fs == 2) {
	    return 22;
	}
        if (vs == 0 && es == 0 && fs == 1) {
	    return 23;
	}
        if (vs == 0 && es == 0 && fs == 2) {
	    return 24;
	}
        if (vs == 0 && es == 0 && fs == 3) {
	    return 25;
	}
        if (vs == 0 && es == 0 && fs == 4) {
	    return 26;
	}
        if (vs == 1 && es == 0 && fs == 1) {
	    return 27;
	}
        return -1;
    }
}
