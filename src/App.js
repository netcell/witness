import React, { useState, useEffect, useCallback } from "react";
import "rc-slider/assets/index.css";
import "./styles.css";
import "lodash.combinations";
import _ from "lodash";
import randomColor from "randomcolor";
import bg from "./bg.png";
import bgDay from "./bgday.png";
import Slider from "rc-slider";
import { Swipeable } from "react-swipeable";

const ZERO = { row: 0, col: 0 };
const LEFT = { row: 0, col: -1 };
const RIGHT = { row: 0, col: 1 };
const DOWN = { row: 1, col: 0 };
const UP = { row: -1, col: 0 };

const COLORS = [
  "0.9372549, 0.4509804, 0.654902",
  "0.5921569, 0.44313726, 0.84705883",
  "0.972549, 0.78431374, 0.3529412",
  "0.78039217, 0.827451, 0.3254902",
  "0.41568628, 0.7607843, 0.8392157",
  "0.37254903, 0.87058824, 0.7019608",
  "0.827451, 0.4392157, 0.3254902",
  "0.3372549, 0.3254902, 0.827451",
  "0.3529412, 0.827451, 0.3254902",
  "0.79607844, 0.3254902, 0.827451",
  "0.827451, 0.7529412, 0.3254902",
  "0.827451, 0.3254902, 0.45882353",
  "0.827451, 0.3254902, 0.3647059",
  "1, 0.62352943, 0.77254903"
].map(color => {
  const [r, g, b] = color.split(", ");
  return (
    "rgb(" + [(r * 255) >> 0, (g * 255) >> 0, (b * 255) >> 0].join(", ") + ")"
  );
});

const addPoint = (node1, node2) => {
  return {
    row: node1.row + node2.row,
    col: node1.col + node2.col
  };
};

const hashPosition = ({ row, col }) => `${row}.${col}`;
const hashLine = ({ from, to }) => {
  const [_from, _to] = _.sortBy([from, to], hashPosition);
  return `${hashPosition(_from)}-${hashPosition(_to)}`;
};

const checklineCrossed = (from, to, linePositions, lastDirection) => {
  const parallel = (from.row === to.row ? [UP, DOWN] : [LEFT, RIGHT])
    .filter(dir => dir !== lastDirection)
    .map(dir => ({
      from: to,
      to: addPoint(to, dir)
    }))
    .map(line => linePositions[hashLine(line)])
    .filter(line => line && line.selected);
  return parallel.length === 2;
};

const checkLineClosed = (from, to, size, linePositions, lastDirection) => {
  const condition =
    from.row === to.row
      ? to.col === 0 || to.col === size
      : to.row === 0 || to.row === size;
  return condition && !checklineCrossed(from, to, linePositions, lastDirection);
};

const actionCalc = ({
  direction,
  current,
  lineNodePositions,
  linePositions,
  lastDirections
}) => {
  const size = lineNodePositions.length / 2 - 1;
  const nextPosition = addPoint(current, direction);
  const nextNode = lineNodePositions[hashPosition(nextPosition)];
  if (!nextNode) return;
  const line =
    linePositions[
      hashLine({
        from: current,
        to: nextNode
      })
    ];
  const [lastDirection, ...remainLastDirections] = lastDirections;
  let nextLastDirections = [direction, ...lastDirections];
  let nextLinePositions = { ...linePositions };
  let cross = false;
  if (line.selected) {
    if (lastDirection) {
      const zero = addPoint(direction, lastDirection);
      if (zero.row === 0 && zero.col === 0) {
        nextLinePositions = {
          ...linePositions,
          [hashLine(line)]: {
            ...line,
            selected: false
          }
        };
        nextLastDirections = remainLastDirections;
      } else return;
    } else return;
  } else if (
    checklineCrossed(nextNode, current, linePositions, lastDirection)
  ) {
    return {
      nextNode: current,
      nextLastDirections: lastDirections,
      nextLinePositions: linePositions,
      cross: true,
      closed: false
    };
  } else {
    nextLinePositions = {
      ...linePositions,
      [hashLine(line)]: {
        ...line,
        selected: true
      }
    };
  }

  return {
    nextNode,
    nextLastDirections,
    nextLinePositions,
    cross,
    closed: checkLineClosed(
      current,
      nextNode,
      size,
      linePositions,
      lastDirection
    )
  };
};

const permutation = size => {
  return _.chain(size)
    .range()
    .map(col => {
      return _.range(size).map(row => ({
        row,
        col,
        key: hashPosition({ row, col })
      }));
    })
    .flatten()
    .keyBy("key")
    .value();
};

const nodeDirToLineDirs = direction => {
  switch (direction) {
    case UP:
      return {
        from: ZERO,
        to: RIGHT
      };
    case DOWN:
      return {
        from: DOWN,
        to: RIGHT
      };
    case LEFT:
      return {
        from: ZERO,
        to: DOWN
      };
    case RIGHT:
      return {
        from: RIGHT,
        to: DOWN
      };
    default:
      return null;
  }
};

const adjacentLine = (node, direction, linePositions) => {
  const lineDirs = nodeDirToLineDirs(direction);
  const from = addPoint(node, lineDirs.from);
  const to = addPoint(from, lineDirs.to);
  return linePositions[hashLine({ from, to })];
};

const colorNodes = (node, nodePositions, linePositions, stop = false) => {
  if (node.colorIndex === undefined) node.colorIndex = 0;
  const colorIndex = node.colorIndex;
  const segment = _.chain([UP, DOWN, LEFT, RIGHT])
    .map(dir => {
      const nextPosition = addPoint(node, dir);
      const nextNode = nodePositions[hashPosition(nextPosition)];
      if (!nextNode || nextNode.colorIndex !== undefined) return null;
      const line = adjacentLine(node, dir, linePositions);
      return {
        group: !line.selected ? "same" : "different",
        nextNode
      };
    })
    .compact()
    .groupBy("group")
    .value();
  segment.same &&
    segment.same.forEach(node => {
      node.nextNode.colorIndex = colorIndex;
      colorNodes(node.nextNode, nodePositions, linePositions, true);
    });
  if (stop) return;

  const nextNode = _.find(nodePositions, node => node.colorIndex === undefined);

  if (!nextNode) return;
  nextNode.colorIndex = colorIndex + 1;
  colorNodes(nextNode, nodePositions, linePositions, false);
};

const traverse = (lineNodePositions, linePositions, loop = 500) => {
  let lastResult = {
    current: lineNodePositions["0.0"],
    linePositions,
    lastDirections: [],
    end: false
  };
  for (let index = 0; index < loop; index++) {
    const result = actionCalc({
      direction: _.sample([UP, DOWN, LEFT, RIGHT]),
      ...lastResult,
      lineNodePositions
    });
    if (result) {
      const {
        nextNode,
        nextLastDirections,
        nextLinePositions,
        closed,
        cross
      } = result;
      lastResult = {
        current: nextNode,
        linePositions: nextLinePositions,
        lastDirections: nextLastDirections,
        end: closed || cross
      };
    }
    if (index === loop - 1 && !lastResult.end) index = loop - 2;
  }
  return lastResult;
};

function useWindowSize() {
  const isClient = typeof window === "object";

  function getSize() {
    return {
      width: isClient ? window.innerWidth : undefined,
      height: isClient ? window.innerHeight : undefined
    };
  }

  const [windowSize, setWindowSize] = useState(getSize);

  useEffect(() => {
    if (!isClient) {
      return false;
    }

    function handleResize() {
      setWindowSize(getSize());
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []); // Empty array ensures that effect is only run on mount and unmount

  return windowSize;
}

export default function App() {
  const [showConfig, setShowConfig] = useState(false);

  const [showUI, setShowUI] = useState(true);
  const [themeDay, setThemeDay] = useState(false);

  const [size, setSize] = useState(4);
  const [loop, setLoop] = useState(1000);
  const [lineNodePositions, setLineNodePositions] = useState({});
  const [linePositions, setLinePositions] = useState({});
  const [nodePositions, setNodePositions] = useState({});

  const [current, setCurrent] = useState({});
  const [lastDirections, setLastDirections] = useState([]);
  const [replay, setReplay] = useState([]);
  const [endLine, setEndLine] = useState({
    direction: UP,
    point: { row: 0, col: 0 }
  });

  const wz = useWindowSize();

  const scaleSize =
    wz.width > wz.height ? wz.height / (size * 90) : wz.width / (size * 90);

  const init = () => {
    const lineNodePositions = permutation(size + 1);
    const nodePositions = permutation(size);

    const linePositions = _.chain(lineNodePositions)
      .combinations(2)
      .filter(([from, to]) => {
        return (
          (from.row === to.row || from.col === to.col) &&
          !(from.row === to.row && from.col === to.col) &&
          Math.abs(to.row - from.row < 2) &&
          Math.abs(to.col - from.col < 2)
        );
      })
      .map(([from, to]) => ({ from, to, key: hashLine({ from, to }) }))
      .uniqBy("key")
      .keyBy("key")
      .value();

    const {
      current: lastPosition,
      linePositions: _linePositions,
      lastDirections
    } = traverse(lineNodePositions, linePositions);
    try {
      colorNodes(nodePositions["0.0"], nodePositions, _linePositions);
    } catch (e) {
      console.error(e);
    }

    setReplay(lastDirections.reverse());

    setCurrent(lineNodePositions["0.0"]);

    setLineNodePositions(lineNodePositions);
    setLinePositions(linePositions);
    setNodePositions(nodePositions);

    setEndLine({
      direction: lastDirections[0],
      point: lastPosition
    });
  };

  useEffect(init, [size, loop]);

  const action = useCallback(
    direction => () => {
      const result = actionCalc({
        direction,
        current,
        lineNodePositions,
        linePositions,
        lastDirections
      });

      if (!result) return false;

      const {
        nextNode,
        nextLastDirections,
        nextLinePositions,
        closed
      } = result;
      setCurrent(nextNode);
      setLastDirections(nextLastDirections);
      setLinePositions(nextLinePositions);
      return closed;
    },
    [current, lineNodePositions, linePositions, lastDirections]
  );

  const replayNext = useCallback(() => {
    const [direction, ...remainReplay] = replay;
    if (!direction) return;
    action(direction)();
    setReplay(remainReplay);
  }, [replay, action]);

  useEffect(() => {
    const handleKeyPressed = event => {
      switch (event.key) {
        case "q":
          setShowUI(!showUI);
          break;
        case "w":
          setThemeDay(!themeDay);
          break;
        case "e":
          setShowConfig(!showConfig);
          break;
        case " ":
          replayNext();
          break;
        default:
          return;
      }
    };
    window.addEventListener("keyup", handleKeyPressed);
    return () => {
      window.removeEventListener("keyup", handleKeyPressed);
    };
  }, [showUI, themeDay, showConfig, replayNext]);

  return (
    <Swipeable
      trackMouse
      delta={2}
      onSwipedLeft={action(LEFT)}
      onSwipedRight={action(RIGHT)}
      onSwipedDown={action(DOWN)}
      onSwipedUp={action(UP)}
    >
      <div
        className="App"
        style={{
          paddingTop: "50px",
          paddingBottom: "50px",
          margin: 0,
          background: `url(${themeDay ? bgDay : bg})`,
          backgroundSize: "cover",
          pointerEvent: "none",
          userSelect: "none",
          boxSizing: "border-box"
        }}
        tabIndex="0"
      >
        <div
          style={{
            height: "auto",
            opacity: showUI ? 1 : 0
          }}
        >
          <p
            style={{
              margin: 0
            }}
          >
            <span
              onClick={init}
              style={{
                color: "white",
                fontSize: "41px",
                textTransform: "uppercase",
                fontWeight: "bold",
                cursor: "pointer",
                userSelect: "none"
              }}
            >
              {/* Ball Sort */}
            </span>
          </p>
          <p
            style={{
              marginTop: 0
            }}
          >
            <span
              onClick={init}
              style={{
                color: "white",
                fontSize: "25px",
                textTransform: "uppercase",
                fontWeight: "bold",
                cursor: "pointer",
                userSelect: "none"
              }}
            >
              {/* Puzzle */}
            </span>
          </p>
          <div
            style={{
              height: showConfig ? 130 : 0,
              overflow: "hidden",
              transition: "ease all 0.2s"
            }}
          >
            <p
              style={{
                width: 300,
                margin: "0px auto 40px"
              }}
            >
              <label style={{ color: "white" }}>Size {size}</label>
              <Slider
                dots
                step={1}
                value={size}
                min={2}
                max={6}
                onChange={setSize}
              />
            </p>
            <p
              style={{
                width: 300,
                margin: "0px auto 40px"
              }}
            >
              <label style={{ color: "white" }}>Iterate {loop}</label>
              <Slider
                step={20}
                value={loop}
                min={10}
                max={1000}
                onChange={setLoop}
              />
            </p>
          </div>

          <p>
            <span
              onClick={() => setShowConfig(!showConfig)}
              style={{
                padding: 10,
                color: "black",
                fontSize: "20px",
                textTransform: "uppercase",
                fontWeight: "bold",
                background: "#FFD200",
                cursor: "pointer",
                userSelect: "none",
                borderRadius: 10,
                boxShadow: "0 5px 0px 1px #CD5900"
              }}
            >
              {showConfig ? "Hide" : "Show"} Config
            </span>{" "}
            &emsp;
            <span
              onClick={init}
              style={{
                padding: 10,
                color: "black",
                fontSize: "20px",
                textTransform: "uppercase",
                fontWeight: "bold",
                background: "#FFD200",
                cursor: "pointer",
                userSelect: "none",
                borderRadius: 10,
                boxShadow: "0 5px 0px 1px #CD5900"
              }}
            >
              Reset
            </span>
          </p>
        </div>
        <div
          style={{
            width: scaleSize * (size * 60 + 30),
            height: scaleSize * (size * 60 + 30),
            position: "relative",
            margin: "auto",
            marginTop: 50,
            border: "2px solid #BBBABB",
            background: "rgba(255, 255, 255, 0.1)",
            borderRadius: 15
          }}
        >
          {_.map(linePositions, ({ from, to, selected, key }) => (
            <div
              key={key}
              style={{
                borderRadius: scaleSize * 5,
                background: selected ? "white" : "rgba(255, 255, 255, 0.1)",
                zIndex: selected ? 1 : 0,
                width:
                  scaleSize * ((to.col - from.col) * 60 + (selected ? 5 : 1)),
                height:
                  scaleSize * ((to.row - from.row) * 60 + (selected ? 5 : 1)),
                color: "white",
                position: "absolute",
                left: scaleSize * (from.col * 60 + 14),
                top: scaleSize * (from.row * 60 + 14),
                transition: "all ease 0.2s",
                // border: `2px #fff solid`,
                // boxShadow: themeDay
                //   ? "0 0 10px 1px rgba(0, 0, 0, 0.1)"
                //   : "0 0 10px 10px rgba(0, 0, 0, 0.5)",
                pointerEvents: "none",
                boxSizing: "border-box"
              }}
            />
          ))}
          <div
            key={"start"}
            style={{
              borderRadius: scaleSize * 5,
              background: "white",
              zIndex: 1,
              width: scaleSize * 5,
              height: scaleSize * 5,
              position: "absolute",
              left: scaleSize * (current.col * 60 + 14),
              top: scaleSize * (current.row * 60 + 14),
              transition: "all ease 0.2s",
              transform: "scale(3)",
              // border: `2px #888 solid`,
              // boxShadow: themeDay
              //   ? "0 0 10px 1px rgba(0, 0, 0, 0.1)"
              //   : "0 0 10px 10px rgba(0, 0, 0, 0.5)",
              pointerEvents: "none",
              boxSizing: "border-box"
            }}
          />
          <div
            key={"end"}
            style={{
              borderRadius: scaleSize * 20,
              background: "black",
              zIndex: 0,
              // width: scaleSize * 5,
              // height: scaleSize * 5,
              width: scaleSize * 20,
              height: scaleSize * 20,
              position: "absolute",
              left: scaleSize * (endLine.point.col * 60 + 6.5),
              top: scaleSize * (endLine.point.row * 60 + 6.5),
              transition: "all ease 0.2s",
              transform: "scale(1)",
              border: `3px #fff solid`,
              // boxShadow: themeDay
              //   ? "0 0 10px 1px rgba(0, 0, 0, 0.1)"
              //   : "0 0 10px 10px rgba(0, 0, 0, 0.5)",
              pointerEvents: "none",
              boxSizing: "border-box"
            }}
          />
          {_.map(nodePositions, ({ row, col, key, colorIndex }) => (
            <div
              key={key}
              style={{
                borderRadius: scaleSize * 35,
                background: COLORS[colorIndex],
                width: scaleSize * 35,
                height: scaleSize * 35,
                position: "absolute",
                left: scaleSize * (col * 60 + 27),
                top: scaleSize * (row * 60 + 27),
                transition: "all ease 0.2s",
                border: `2px white solid`,
                // boxShadow: themeDay
                //   ? "0 0 10px 1px rgba(0, 0, 0, 0.1)"
                //   : "0 0 10px 10px rgba(0, 0, 0, 0.5)",
                pointerEvents: "none",
                boxSizing: "border-box"
              }}
            />
          ))}
        </div>
      </div>
    </Swipeable>
  );
}
