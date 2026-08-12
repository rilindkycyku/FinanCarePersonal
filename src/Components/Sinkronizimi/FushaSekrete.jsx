import { useState } from "react";
import { Button, Col, Form, InputGroup } from "react-bootstrap";
import { Eye, EyeOff } from "lucide-react";

/**
 * A field whose value is hidden until asked for. Everything typed into the sync page is a long
 * string copied from somewhere else and impossible to proofread as dots - and a mistyped key fails
 * with "the project did not accept it", which does not tell anyone which character went wrong.
 */
function FushaSekrete({ id, md, label, ndihma, ...props }) {
  const [dukshem, setDukshem] = useState(false);
  return (
    <Form.Group as={Col} md={md} controlId={id}>
      <Form.Label>{label}</Form.Label>
      <InputGroup>
        <Form.Control type={dukshem ? "text" : "password"} spellCheck={false} {...props} />
        <Button
          variant="outline-light"
          onClick={() => setDukshem((v) => !v)}
          // Keeps the button from taking focus on a tap, which would otherwise leave it sitting in
          // its filled "pressed" state next to the field the user is typing in. Tabbing to it still
          // works, and still shows the focus ring, so the toggle is not mouse-only.
          onMouseDown={(e) => e.preventDefault()}
          aria-label={dukshem ? "Fshih vlerën" : "Shfaq vlerën"}
          aria-pressed={dukshem}
          title={dukshem ? "Fshih" : "Shfaq"}
        >
          {dukshem ? <EyeOff size={16} /> : <Eye size={16} />}
        </Button>
      </InputGroup>
      {ndihma && <div className="fcp-row-sub mt-1">{ndihma}</div>}
    </Form.Group>
  );
}

export default FushaSekrete;
