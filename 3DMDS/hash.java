import java.text.*;
import java.io.*;
import java.util.*;

public class hash {

    /* use an ordinary matrix if possible, a hash table if necessary */

    int m, n;

    HashMap <Integer,Integer> H;
    int[][] h;

    boolean hashed = true;;

    public hash(int mm, int nn) {
	m = mm;
        n = nn;
        H = null;
        h = null;
        System.gc();
        hashed = false;
        try {
	    h = new int[m][n];
	}
        catch (Error E) {
	    hashed = true;
            h = null;
            System.gc();
	}
        if (hashed) {
            boolean done = false;
            H = null;
            System.gc();
            long M = m;
            long N = n;
            long c = M*N;
            c = c/500;
            int capacity = (int) c;
            if (capacity < 0) {
		capacity = 10000000;
	    }
            float load = 0.75f;
	    while (!done) {
		try {
		    done = true;
		    H = new HashMap <Integer, Integer> (capacity, load);
		}
		catch (Error E) {
		    H = null;
		    System.gc();
		    done = false;
		    capacity /= 2;
		}
	    }
            write(" hashing capacity " + capacity + " load factor " + load);
	}
    }

    int get (int i, int j) {
        if (!hashed) {
	    return h[i][j];
        }
        else {
	    int K = key(i,j);
            int result = 0;
            if (H.get(K) != null) {
		result = H.get(K);
	    }
            return result;
	}
    }        

    void put (int i, int j, int z) {
        if (!hashed) {
	    h[i][j] = z;
	}
        else {
            int K = key(i,j);
            if (z != 0) {
		H.put(K,z);
	    }
            else if (H.containsKey(K)) {
                H.remove(K);
	    }
	}
    }

    int key(int i, int j) {
        if (0 > i || 0 > j || i >=m || j >=n) {
	    write(" invalid hash location: i = " + i + " j = " + j + " m = " + m + " n = " +n);
            tv.TV.stop();
	}
        else {
	    return 1 + n*i + j;
	}
        return -1;
    }

    void debug(String s) {
	System.out.println("hash " + s);
    }

    void write(String s) {
        System.out.println(s);
    }

    void report() {
	int nz = 0;
        long code = 0;
        write(" unreduced matrix is " + m + " by " + n);
        if (!hashed) {               
            write(" ordinary matrix ");
	    for (int i = 0; i < m; i++) {
		for (int j = 0; j < n; j++) {

		    if (h[i][j] != 0) {
                        nz++;
                        code += i*j+i+j;
		    }
		}
	    }
	}
        else {
            write(" hashing ");
	    nz = H.size();
	    for (int i = 0; i < m; i++) {
		for (int j = 0; j < n; j++) {
		    int K = key(i,j);
		    int result = 0;
		    if (H.get(K) != null) {
			result = H.get(K);
		    }
		    if (result != 0) {
                        nz++;
                        code += i*j+i+j;
		    }
		}
	    }
	}
        double per = nz/((double) m)/((double) n)*100;
        DecimalFormat f = new DecimalFormat("#.##");
        String Per = f.format(per);
        write("code = " + code +" --- " + nz + " non-zero entries  = " + Per + " percent ");
    }
}
