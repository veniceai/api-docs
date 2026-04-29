export const AuthorByline = ({ name, date }) => {
  return (
    <p
      style={{
        marginTop: "-1rem",
        marginBottom: "1.5rem",
      }}
    >
      <small>
        Originally written by {name} - {date}
      </small>
    </p>
  );
};
