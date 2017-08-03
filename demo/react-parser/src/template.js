module.exports = `<div>
      <state declare="
          data as {a: 1},
          "
      />

        <Button onClick={()=>{
            console.log(data);
        }}>按钮</Button>
  </div>
`;
