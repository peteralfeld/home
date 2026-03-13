# Clean Target
clean:
	rm *~ *#* *.bak foo* goo*

www:	clean
	cp index.html /cygdrive/c/xampp/htdocs/www/Reversi
	cp Reversi.css /cygdrive/c/xampp/htdocs/www/Reversi 
	cp Reversi.js /cygdrive/c/xampp/htdocs/www/Reversi 
	cp ReversiWorker.js /cygdrive/c/xampp/htdocs/www/Reversi 
	cp ReversiEngine.cpp /cygdrive/c/xampp/htdocs/www/Reversi 
	cp ReversiEngine.wasm /cygdrive/c/xampp/htdocs/www/Reversi 
	cp Reversi.html /cygdrive/c/xampp/htdocs/www/Reversi
	cp start.png /cygdrive/c/xampp/htdocs/www/Reversi
	cp 1.png /cygdrive/c/xampp/htdocs/www/Reversi
	cp 2.png /cygdrive/c/xampp/htdocs/www/Reversi
	cp 3.png /cygdrive/c/xampp/htdocs/www/Reversi
	cp 4.png /cygdrive/c/xampp/htdocs/www/Reversi

wasm:
	emcc ReversiEngine.cpp -o ReversiEngine.wasm -O3 -s EXPORTED_FUNCTIONS="['_malloc', '_free']" --no-entry -s STANDALONE_WASM=1
