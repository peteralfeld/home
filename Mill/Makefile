# Makefile for Mill C++ Engine
# Assumes 'emsdk' is installed centrally and 'emcc' is in your PATH.

# Compiler
EMCC = emcc

# Input/Output
SOURCE = mill_engine.cpp
OUTPUT = mill_engine.js

# Compiler Flags
# -O3: Aggressive optimization for speed
# -s ALLOW_MEMORY_GROWTH=1: Allows the engine to use more RAM if needed
# -s EXPORTED_RUNTIME_METHODS=['HEAP32']: Allows JS to read C++ memory directly
# -s EXPORTED_FUNCTIONS: List of C++ functions JS can call
FLAGS = -O3 \
	-s ALLOW_MEMORY_GROWTH=1 \
	-s EXPORTED_RUNTIME_METHODS="['HEAP32']" \
	-s EXPORTED_FUNCTIONS="['_initEngine', '_setBrain', '_clearTT', '_search', '_malloc', '_free', '_getNodesVisited', '_setTTEnabled', '_setPruningEnabled']"

# Main Target
all: $(OUTPUT)

$(OUTPUT): $(SOURCE)
	@echo "Compiling C++ Engine..."
	$(EMCC) $(SOURCE) $(FLAGS) -o $(OUTPUT)
	@echo "Done! mill_engine.js and mill_engine.wasm updated."

# Clean Target
clean:
	rm *~ *#* *.bak foo* goo*

www:
	cp DM.png /cygdrive/c/xampp/htdocs/pa/Mill
	cp DM2.png /cygdrive/c/xampp/htdocs/pa/Mill
	cp GS.png /cygdrive/c/xampp/htdocs/pa/Mill
	cp Makefile /cygdrive/c/xampp/htdocs/pa/Mill
	cp Mill.css /cygdrive/c/xampp/htdocs/pa/Mill
	cp Mill.html /cygdrive/c/xampp/htdocs/pa/Mill
	cp Mill.js /cygdrive/c/xampp/htdocs/pa/Mill
	cp Mills.png /cygdrive/c/xampp/htdocs/pa/Mill
	cp NM.png /cygdrive/c/xampp/htdocs/pa/Mill
	cp Tournament.csv /cygdrive/c/xampp/htdocs/pa/Mill
	cp brains.csv /cygdrive/c/xampp/htdocs/pa/Mill
	cp empty.png /cygdrive/c/xampp/htdocs/pa/Mill
	cp gameWindow.png /cygdrive/c/xampp/htdocs/pa/Mill
	cp js_worker.js /cygdrive/c/xampp/htdocs/pa/Mill
	cp manual.html /cygdrive/c/xampp/htdocs/pa/Mill
	cp millOB.json /cygdrive/c/xampp/htdocs/pa/Mill
	cp millWorker.js /cygdrive/c/xampp/htdocs/pa/Mill
	cp mill_engine.cpp /cygdrive/c/xampp/htdocs/pa/Mill
	cp mill_engine.js /cygdrive/c/xampp/htdocs/pa/Mill
	cp mill_engine.wasm /cygdrive/c/xampp/htdocs/pa/Mill
	cp overview.html /cygdrive/c/xampp/htdocs/pa/Mill
	cp rules.html /cygdrive/c/xampp/htdocs/pa/Mill
	cp shared.js /cygdrive/c/xampp/htdocs/pa/Mill
	cp thumbprint.jpg /cygdrive/c/xampp/htdocs/pa/Mill
	cp wasm_worker.js /cygdrive/c/xampp/htdocs/pa/Mill
	cp workers.png /cygdrive/c/xampp/htdocs/pa/Mill
	cp DM.png /cygdrive/c/xampp/htdocs/www/Mill
	cp DM2.png /cygdrive/c/xampp/htdocs/www/Mill
	cp GS.png /cygdrive/c/xampp/htdocs/www/Mill
	cp Makefile /cygdrive/c/xampp/htdocs/www/Mill
	cp Mill.css /cygdrive/c/xampp/htdocs/www/Mill
	cp Mill.html /cygdrive/c/xampp/htdocs/www/Mill
	cp Mill.js /cygdrive/c/xampp/htdocs/www/Mill
	cp Mills.png /cygdrive/c/xampp/htdocs/www/Mill
	cp NM.png /cygdrive/c/xampp/htdocs/www/Mill
	cp Tournament.csv /cygdrive/c/xampp/htdocs/www/Mill
	cp brains.csv /cygdrive/c/xampp/htdocs/www/Mill
	cp empty.png /cygdrive/c/xampp/htdocs/www/Mill
	cp gameWindow.png /cygdrive/c/xampp/htdocs/www/Mill
	cp js_worker.js /cygdrive/c/xampp/htdocs/www/Mill
	cp manual.html /cygdrive/c/xampp/htdocs/www/Mill
	cp millOB.json /cygdrive/c/xampp/htdocs/www/Mill
	cp millWorker.js /cygdrive/c/xampp/htdocs/www/Mill
	cp mill_engine.cpp /cygdrive/c/xampp/htdocs/www/Mill
	cp mill_engine.js /cygdrive/c/xampp/htdocs/www/Mill
	cp mill_engine.wasm /cygdrive/c/xampp/htdocs/www/Mill
	cp overview.html /cygdrive/c/xampp/htdocs/www/Mill
	cp rules.html /cygdrive/c/xampp/htdocs/www/Mill
	cp shared.js /cygdrive/c/xampp/htdocs/www/Mill
	cp thumbprint.jpg /cygdrive/c/xampp/htdocs/www/Mill
	cp wasm_worker.js /cygdrive/c/xampp/htdocs/www/Mill
	cp workers.png /cygdrive/c/xampp/htdocs/www/Mill
