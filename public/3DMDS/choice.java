import java.awt.*;

class choice extends Choice {
      
    boolean trigger = true;
 
    void reset () {
        if (getSelectedIndex() > 0) {
	    trigger = false;
	    select(0);
	}
    }
}
